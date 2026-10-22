-- The bot now updates a person's own row (their DM choices and time zone), so slack_user_links needs UPDATE for
-- app_tenant (0033 granted SELECT, INSERT, DELETE). slack_sent_claims has no tenant_id, no policy and no grant on
-- purpose: only the plain connection (the notification sweep) touches it, like slack_message_claims.
GRANT UPDATE ON slack_user_links TO app_tenant;
