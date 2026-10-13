-- Moves every owner from a login (Neon Auth user id) to a team person (team_people, 0025), so work can be owned by
-- people who never sign in. Runs once, before 0027 drops the old *_user_id owner columns.

-- 1. One person per existing workspace member, linked to their login.
INSERT INTO team_people (tenant_id, name, email, user_id)
SELECT tm.tenant_id, coalesce(nullif(u.name, ''), u.email), lower(u.email), tm.user_id
FROM tenant_members tm
JOIN neon_auth."user" u ON u.id::text = tm.user_id
ON CONFLICT (tenant_id, user_id) DO NOTHING;
--> statement-breakpoint

-- 2. Every owner/assignee column: user id → that user's person in the same workspace.
UPDATE activities a SET assigned_to_person_id = p.id
FROM team_people p WHERE p.tenant_id = a.tenant_id AND p.user_id = a.assigned_to_user_id AND a.assigned_to_user_id IS NOT NULL;
--> statement-breakpoint
UPDATE traction_measurables m SET owner_person_id = p.id
FROM team_people p WHERE p.tenant_id = m.tenant_id AND p.user_id = m.owner_user_id AND m.owner_user_id IS NOT NULL;
--> statement-breakpoint
UPDATE traction_rocks r SET owner_person_id = p.id
FROM team_people p WHERE p.tenant_id = r.tenant_id AND p.user_id = r.owner_user_id AND r.owner_user_id IS NOT NULL;
--> statement-breakpoint
UPDATE traction_issues i SET owner_person_id = p.id
FROM team_people p WHERE p.tenant_id = i.tenant_id AND p.user_id = i.owner_user_id AND i.owner_user_id IS NOT NULL;
--> statement-breakpoint
UPDATE traction_issues i SET raised_by_person_id = p.id
FROM team_people p WHERE p.tenant_id = i.tenant_id AND p.user_id = i.raised_by_user_id AND i.raised_by_user_id IS NOT NULL;
--> statement-breakpoint

-- 3. Meeting ratings were keyed by user id; key them by person id (an unknown key is kept as it was).
UPDATE traction_meetings m SET ratings = coalesce((
  SELECT jsonb_object_agg(coalesce(p.id::text, r.key), r.value)
  FROM jsonb_each(m.ratings) r
  LEFT JOIN team_people p ON p.tenant_id = m.tenant_id AND p.user_id = r.key
), '{}'::jsonb);
--> statement-breakpoint

-- 4. Grants (drizzle-kit doesn't manage them, see 0004). The app owns all of these; the scraper gets nothing.
GRANT SELECT, INSERT, UPDATE ON team_people TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_seats TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_people_reviews TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON traction_processes TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON traction_l10_settings TO app_tenant;
--> statement-breakpoint
-- A meeting is now updated while it runs (each member's rating) — until it is concluded.
GRANT UPDATE ON traction_meetings TO app_tenant;
