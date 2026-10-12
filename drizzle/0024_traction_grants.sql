-- Grants for the Traction tables (0023 adds the tables + RLS policies; grants aren't managed by drizzle-kit, see 0004).
-- RLS decides WHICH rows (the workspace's own); these decide WHICH operations. The app owns all of Traction: it
-- creates, edits and deletes every row. The lead-engine job (lead_scraper) gets nothing here.
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_measurables TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_entries TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_rocks TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_issues TO app_tenant;
--> statement-breakpoint
-- A concluded meeting is history: it can be read and recorded, never edited.
GRANT SELECT, INSERT, DELETE ON traction_meetings TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON traction_vto TO app_tenant;
