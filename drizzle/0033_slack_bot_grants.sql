-- Grants for the Slack bot tables (0032 adds them with their RLS policies; grants aren't managed by drizzle-kit, see 0004).
-- A pending action is created, read, marked used and swept when expired; a link is created and read (and dropped by the
-- workspace admin). slack_installations and slack_message_claims have no policy and no grant on purpose: only the plain
-- connection (the webhook's pre-tenant lookup) touches them, like `invites`.
GRANT SELECT, INSERT, UPDATE, DELETE ON slack_pending_actions TO app_tenant;
GRANT SELECT, INSERT, DELETE ON slack_user_links TO app_tenant;
