CREATE TABLE "team_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"title" text,
	"user_id" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_people_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "team_people_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "team_people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_l10_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"timezone" text DEFAULT 'America/Phoenix' NOT NULL,
	"reminded_for" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_l10_settings_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "traction_l10_settings_weekday_check" CHECK ("traction_l10_settings"."weekday" between 0 and 6),
	CONSTRAINT "traction_l10_settings_time_check" CHECK ("traction_l10_settings"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "traction_l10_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_people_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"quarter" text NOT NULL,
	"kind" text NOT NULL,
	"reviewer_person_id" uuid,
	"values_ratings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gets_it" boolean,
	"wants_it" boolean,
	"capacity" boolean,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_people_reviews_person_quarter_kind_unique" UNIQUE("tenant_id","person_id","quarter","kind"),
	CONSTRAINT "traction_people_reviews_kind_check" CHECK ("traction_people_reviews"."kind" in ('manager', 'self')),
	CONSTRAINT "traction_people_reviews_quarter_check" CHECK ("traction_people_reviews"."quarter" ~ '^[0-9]{4}-Q[1-4]$')
);
--> statement-breakpoint
ALTER TABLE "traction_people_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"area" text DEFAULT 'other' NOT NULL,
	"owner_person_id" uuid,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stage" text DEFAULT 'documented' NOT NULL,
	"last_reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_processes_area_check" CHECK ("traction_processes"."area" in ('hr', 'sales', 'operations', 'customer_service', 'finance', 'other')),
	CONSTRAINT "traction_processes_stage_check" CHECK ("traction_processes"."stage" in ('documented', 'trained', 'followed'))
);
--> statement-breakpoint
ALTER TABLE "traction_processes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_seat_id" uuid,
	"person_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_seats_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "traction_seats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "traction_measurables" DROP CONSTRAINT "traction_measurables_goal_operator_check";--> statement-breakpoint
ALTER TABLE "traction_rocks" DROP CONSTRAINT "traction_rocks_status_check";--> statement-breakpoint
ALTER TABLE "traction_measurables" ALTER COLUMN "cadence" SET DEFAULT 'weekly';--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "assigned_to_person_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD COLUMN "raised_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD COLUMN "owner_person_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD COLUMN "issue_type" text DEFAULT 'problem' NOT NULL;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD COLUMN "root_cause" text;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "traction_measurables" ADD COLUMN "owner_person_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_measurables" ADD COLUMN "goal_value_max" numeric;--> statement-breakpoint
ALTER TABLE "traction_meetings" ADD COLUMN "status" text DEFAULT 'concluded' NOT NULL;--> statement-breakpoint
ALTER TABLE "traction_meetings" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "traction_meetings" ADD COLUMN "improvement" text;--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD COLUMN "owner_person_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD COLUMN "is_company" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD COLUMN "one_year_goal_id" text;--> statement-breakpoint
ALTER TABLE "team_people" ADD CONSTRAINT "team_people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_l10_settings" ADD CONSTRAINT "traction_l10_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_people_reviews" ADD CONSTRAINT "traction_people_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_people_reviews" ADD CONSTRAINT "traction_people_reviews_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_people_reviews" ADD CONSTRAINT "traction_people_reviews_reviewer_same_tenant_fk" FOREIGN KEY ("tenant_id","reviewer_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_processes" ADD CONSTRAINT "traction_processes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_processes" ADD CONSTRAINT "traction_processes_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_seats" ADD CONSTRAINT "traction_seats_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_seats" ADD CONSTRAINT "traction_seats_parent_same_tenant_fk" FOREIGN KEY ("tenant_id","parent_seat_id") REFERENCES "public"."traction_seats"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_seats" ADD CONSTRAINT "traction_seats_person_same_tenant_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_assigned_person_same_tenant_fk" FOREIGN KEY ("tenant_id","assigned_to_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_raised_by_same_tenant_fk" FOREIGN KEY ("tenant_id","raised_by_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_measurables" ADD CONSTRAINT "traction_measurables_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD CONSTRAINT "traction_rocks_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_person_id") REFERENCES "public"."team_people"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_type_check" CHECK ("traction_issues"."issue_type" in ('problem', 'idea', 'obstacle'));--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_outcome_check" CHECK ("traction_issues"."outcome" is null or "traction_issues"."outcome" in ('solved', 'yes', 'no', 'later', 'removed', 'escalated'));--> statement-breakpoint
ALTER TABLE "traction_measurables" ADD CONSTRAINT "traction_measurables_goal_operator_check" CHECK ("traction_measurables"."goal_operator" is null or "traction_measurables"."goal_operator" in ('gte', 'lte', 'eq', 'between'));--> statement-breakpoint
ALTER TABLE "traction_meetings" ADD CONSTRAINT "traction_meetings_status_check" CHECK ("traction_meetings"."status" in ('in_progress', 'concluded'));--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD CONSTRAINT "traction_rocks_status_check" CHECK ("traction_rocks"."status" in ('on_track', 'off_track', 'complete', 'dropped', 'rolled_over'));--> statement-breakpoint
CREATE POLICY "team_people_tenant_isolation" ON "team_people" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_l10_settings_tenant_isolation" ON "traction_l10_settings" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_people_reviews_tenant_isolation" ON "traction_people_reviews" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_processes_tenant_isolation" ON "traction_processes" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_seats_tenant_isolation" ON "traction_seats" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);