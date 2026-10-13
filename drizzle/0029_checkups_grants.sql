-- Grants for traction_checkups (0028 adds it with its RLS policy; grants aren't managed by drizzle-kit, see 0004).
-- A checkup is a record of a moment: it can be taken and read, and deleted if taken by mistake — never edited.
GRANT SELECT, INSERT, DELETE ON traction_checkups TO app_tenant;
-- portfolio_scorecard_template has no tenant_id: only the platform connection (the super admin's actions) touches
-- it, so app_tenant gets no grant at all.
