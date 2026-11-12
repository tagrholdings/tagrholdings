import { Pool } from "pg";

/**
 * Sends ONE person their weekly Slack summaries right now (the Monday plan and the Friday review), to see what they look
 * like. It claims nothing, so the real Monday/Friday messages still go out. The bot, the database and Gemini come from the
 * environment, so run it with the right env file and name the database you expect:
 *
 *   PREVIEW_EXPECT_HOST="ep-your-branch-id" PREVIEW_EMAIL="you@company.com" \
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/preview-weekly.ts
 *
 * (`--conditions=react-server` lets the `server-only` imports load outside Next.)
 */
async function main() {
  const expectHost = process.env.PREVIEW_EXPECT_HOST;
  const email = process.env.PREVIEW_EMAIL?.trim().toLowerCase();
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!expectHost || !email || !url) throw new Error("Set PREVIEW_EXPECT_HOST and PREVIEW_EMAIL (and a DATABASE_URL in the env file).");
  const host = new URL(url).host;
  if (!host.includes(expectHost)) throw new Error(`Refusing to run: database host "${host}" does not contain "${expectHost}".`);
  console.log(`Database: ${host}`);

  const pool = new Pool({ connectionString: url });
  const users = await pool.query<{ id: string }>(`select id::text as id from neon_auth."user" where lower(email) = $1`, [email]);
  await pool.end();
  if (users.rows.length !== 1) throw new Error(`Expected one login for ${email}, found ${users.rows.length}.`);
  const userId = users.rows[0].id;

  const { tenancyService } = await import("../modules/tenancy/tenancy.service");
  const { slackNotifyService } = await import("../modules/slack/slack-notify.service");
  const { slackInstallationsRepository } = await import("../modules/slack/slack-installations.repository");

  const installations = await slackInstallationsRepository.listForApp(process.env.SLACK_APP_ID!.trim());
  for (const installation of installations) {
    const tenant = await tenancyService.getTenant(installation.tenantId);
    if (!tenant || tenant.archivedAt || !(await tenancyService.isMember(tenant.id, userId))) continue;
    for (const kind of (process.env.PREVIEW_KINDS?.split(",") ?? ["plan", "wrap"]) as ("plan" | "wrap")[]) {
      const sent = await slackNotifyService.sendPersonalWeekly(tenant, new Date(), 1, { userId, kind });
      console.log(`${tenant.name} (${tenant.slug}): ${kind} -> ${sent ? "sent" : "nothing to send (no tasks) or no Slack link"}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
