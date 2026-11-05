import { Pool } from "pg";

/**
 * Links a Slack person to a CRM login by hand, for someone whose Slack e-mail differs from their CRM e-mail (the bot
 * normally matches the two). It writes ONE row to slack_user_links; the e-mail of the login is not touched. Undo it by
 * deleting that row (the bot then falls back to matching by e-mail).
 *
 * Dry run by default: it only looks things up and prints what it would insert. Add LINK_APPLY=true to insert.
 *
 * Usage:
 *   LINK_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   LINK_EXPECT_HOST="ep-your-branch-id" \
 *   LINK_CRM_EMAIL="person@company.com" \
 *   LINK_SLACK_USER_ID="U0123ABCDEF" \
 *   [LINK_APPLY=true] \
 *   npx tsx scripts/link-slack-user.ts
 *
 * The host check is the same typed-out confirmation scripts/migrate-explicit.ts asks for.
 */
const connectionString = process.env.LINK_DATABASE_URL;
const expectHost = process.env.LINK_EXPECT_HOST;
const crmEmail = process.env.LINK_CRM_EMAIL?.trim().toLowerCase();
const slackUserId = process.env.LINK_SLACK_USER_ID?.trim();
const apply = process.env.LINK_APPLY === "true";

if (!connectionString) throw new Error("Set LINK_DATABASE_URL to the exact (unpooled) connection string.");
if (!expectHost) throw new Error("Set LINK_EXPECT_HOST to a substring of the expected database host, as a safety check.");
if (!crmEmail) throw new Error("Set LINK_CRM_EMAIL to the person's CRM login e-mail.");
if (!slackUserId || !/^[UW][A-Z0-9]{6,}$/.test(slackUserId)) {
  throw new Error("LINK_SLACK_USER_ID must be a Slack member ID (starts with U or W — not D, which is a DM conversation).");
}

const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);

async function main() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    console.log(`${apply ? "APPLYING to" : "Dry run on"} ${host}`);
    const user = await client.query<{ id: string; name: string | null; email: string }>(
      `select id::text as id, name, email from neon_auth."user" where lower(email) = $1`,
      [crmEmail]
    );
    if (user.rows.length !== 1) throw new Error(`Expected exactly one CRM login for ${crmEmail}, found ${user.rows.length}.`);
    const login = user.rows[0];

    // The workspaces this person belongs to that have the Slack bot connected.
    const targets = await client.query<{ tenant_id: string; name: string; command_channel_id: string | null }>(
      `select distinct i.tenant_id::text as tenant_id, t.name, i.command_channel_id
         from tenant_members tm
         join slack_installations i on i.tenant_id = tm.tenant_id
         join tenants t on t.id = tm.tenant_id
        where tm.user_id = $1`,
      [login.id]
    );
    if (targets.rows.length === 0) throw new Error("That login is not a member of any workspace with the Slack bot connected.");

    for (const t of targets.rows) {
      const existing = await client.query(`select slack_user_id, user_id from slack_user_links where tenant_id = $1 and (slack_user_id = $2 or user_id = $3)`, [t.tenant_id, slackUserId, login.id]);
      console.log(`- ${t.name} (${t.tenant_id}), command channel ${t.command_channel_id ?? "none"}: ${login.name ?? "?"} <${login.email}> ← Slack ${slackUserId}`);
      if (existing.rows.length > 0) {
        console.log(`  already linked: ${JSON.stringify(existing.rows)} — skipping`);
        continue;
      }
      if (!apply) {
        console.log("  would insert one slack_user_links row");
        continue;
      }
      await client.query("begin");
      await client.query(`select set_config('app.tenant_id', $1, true)`, [t.tenant_id]);
      await client.query(`insert into slack_user_links (tenant_id, slack_user_id, user_id) values ($1, $2, $3)`, [t.tenant_id, slackUserId, login.id]);
      await client.query("commit");
      console.log("  inserted.");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
