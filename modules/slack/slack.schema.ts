import { pgTable, uuid, text, timestamp, jsonb, boolean, primaryKey, unique, index } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

/**
 * Which CRM workspace a Slack app installation writes into. A Slack event carries `team_id` + `api_app_id` and the
 * channel, nothing about our workspaces, so this table is the ONLY place the tenant comes from — never from the payload or
 * from the model. The prod and dev apps live in the same Slack team, each with its own database.
 *
 * Has a `tenant_id` but no RLS: the webhook looks it up before the tenant is known, like `invites`. Only the plain
 * `db` touches it (slack-installations.repository.ts). `command_channel_id` is the channel where every message is a
 * command; elsewhere the bot answers only when it is @mentioned.
 */
export const slackInstallationsTable = pgTable(
  "slack_installations",
  {
    slackTeamId: text("slack_team_id").notNull(),
    apiAppId: text("api_app_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    commandChannelId: text("command_channel_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // One Slack team can feed several CRM workspaces, each with its own command channel (a person in two workspaces
    // writes in the channel of the one they mean). A channel belongs to at most one workspace.
    primaryKey({ columns: [t.slackTeamId, t.apiAppId, t.tenantId] }),
    unique("slack_installations_channel_unique").on(t.slackTeamId, t.apiAppId, t.commandChannelId),
    index("slack_installations_tenant_idx").on(t.tenantId),
  ]
);

/**
 * Slack retries a delivery that wasn't answered in 3 seconds, and a message in the command channel that @mentions the
 * bot arrives twice (message + app_mention). Inserting the claim first makes the second arrival a no-op. No tenant_id.
 */
export const slackMessageClaimsTable = pgTable(
  "slack_message_claims",
  {
    apiAppId: text("api_app_id").notNull(),
    channelId: text("channel_id").notNull(),
    messageTs: text("message_ts").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.apiAppId, t.channelId, t.messageTs] })]
);

/**
 * "Already sent" markers for what the bot says unprompted (task reminders, new-lead cards, daily digests, the weekly
 * report). The sweep inserts the key BEFORE it sends, so two overlapping sweeps — or a retry — never send twice; a send that
 * then fails is logged and not repeated, like the push and e-mail reminders. No tenant_id: the key names what it is for.
 */
export const slackSentClaimsTable = pgTable("slack_sent_claims", {
  key: text("key").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * A Slack person, matched by e-mail to a member of the workspace; what they do through the bot is done as that login.
 * The flags are what the person chose to be messaged about directly (by telling the bot); `timeZone` is their Slack
 * profile zone, kept so a morning digest can go out at 8 o'clock THEIR time (the CRM has no per-person zone).
 */
export const slackUserLinksTable = pgTable(
  "slack_user_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    slackUserId: text("slack_user_id").notNull(),
    /** A Neon Auth user id (no FK possible — another schema). */
    userId: text("user_id").notNull(),
    timeZone: text("time_zone"),
    /** DM when one of their tasks is due, and when a task is assigned to them. */
    remindDm: boolean("remind_dm").notNull().default(true),
    /** DM before the weekly L10 meeting. */
    l10Dm: boolean("l10_dm").notNull().default(true),
    /** DM at 8:00 their time with what is due today and overdue. Off until they ask. */
    digestDm: boolean("digest_dm").notNull().default(false),
    /** DM of the weekly report (admins only receive it at all). */
    weeklyDm: boolean("weekly_dm").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("slack_user_links_tenant_slack_user_unique").on(t.tenantId, t.slackUserId), tenantIsolationPolicy("slack_user_links")]
);

/**
 * What the bot proposed and is waiting for a click on. The buttons carry only this row's id: what gets written is read
 * back from `payload`, never from the click, so nothing in Slack can alter it between the card and the confirmation.
 */
export const slackPendingActionsTable = pgTable(
  "slack_pending_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    /** Who asked (the Slack user whose message produced it). */
    slackUserId: text("slack_user_id").notNull(),
    /** "create" | "update" | "complete" — free text, validated by the service. */
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    channelId: text("channel_id").notNull(),
    /** The card's own message, so a click can edit it into "Created ✓". */
    cardTs: text("card_ts"),
    /** "pending" | "done" | "cancelled" — a card can be used once. */
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [tenantIsolationPolicy("slack_pending_actions")]
);
