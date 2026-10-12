CREATE TABLE "traction_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"measurable_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"value" numeric NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_entries_measurable_period_unique" UNIQUE("measurable_id","period_start")
);
--> statement-breakpoint
ALTER TABLE "traction_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"horizon" text DEFAULT 'short_term' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"rank" integer,
	"raised_by_user_id" text,
	"owner_user_id" text,
	"measurable_id" uuid,
	"rock_id" uuid,
	"solution" text,
	"solved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_issues_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "traction_issues_horizon_check" CHECK ("traction_issues"."horizon" in ('short_term', 'long_term')),
	CONSTRAINT "traction_issues_status_check" CHECK ("traction_issues"."status" in ('open', 'solved', 'dropped'))
);
--> statement-breakpoint
ALTER TABLE "traction_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_measurables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text,
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"goal_operator" text,
	"goal_value" numeric,
	"unit" text DEFAULT 'number' NOT NULL,
	"aggregation" text DEFAULT 'sum' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_measurables_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "traction_measurables_cadence_check" CHECK ("traction_measurables"."cadence" in ('weekly', 'monthly')),
	CONSTRAINT "traction_measurables_goal_operator_check" CHECK ("traction_measurables"."goal_operator" is null or "traction_measurables"."goal_operator" in ('gte', 'lte', 'eq')),
	CONSTRAINT "traction_measurables_unit_check" CHECK ("traction_measurables"."unit" in ('number', 'currency', 'percent')),
	CONSTRAINT "traction_measurables_aggregation_check" CHECK ("traction_measurables"."aggregation" in ('sum', 'average', 'latest'))
);
--> statement-breakpoint
ALTER TABLE "traction_measurables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"held_at" timestamp DEFAULT now() NOT NULL,
	"ratings" jsonb NOT NULL,
	"average_rating" numeric,
	"todos_done" integer DEFAULT 0 NOT NULL,
	"todos_total" integer DEFAULT 0 NOT NULL,
	"issues_solved" integer DEFAULT 0 NOT NULL,
	"rocks_off_track" integer DEFAULT 0 NOT NULL,
	"measurables_off_goal" integer DEFAULT 0 NOT NULL,
	"headlines" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traction_meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_rocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quarter" text NOT NULL,
	"title" text NOT NULL,
	"owner_user_id" text,
	"due_date" date,
	"status" text DEFAULT 'on_track' NOT NULL,
	"success_criteria" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_rocks_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "traction_rocks_quarter_check" CHECK ("traction_rocks"."quarter" ~ '^[0-9]{4}-Q[1-4]$'),
	CONSTRAINT "traction_rocks_status_check" CHECK ("traction_rocks"."status" in ('on_track', 'off_track', 'complete', 'dropped'))
);
--> statement-breakpoint
ALTER TABLE "traction_rocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traction_vto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "traction_vto_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "traction_vto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "l10_todo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "issue_id" uuid;--> statement-breakpoint
ALTER TABLE "traction_entries" ADD CONSTRAINT "traction_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_entries" ADD CONSTRAINT "traction_entries_measurable_same_tenant_fk" FOREIGN KEY ("tenant_id","measurable_id") REFERENCES "public"."traction_measurables"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_measurable_same_tenant_fk" FOREIGN KEY ("tenant_id","measurable_id") REFERENCES "public"."traction_measurables"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_issues" ADD CONSTRAINT "traction_issues_rock_same_tenant_fk" FOREIGN KEY ("tenant_id","rock_id") REFERENCES "public"."traction_rocks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_measurables" ADD CONSTRAINT "traction_measurables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_meetings" ADD CONSTRAINT "traction_meetings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_rocks" ADD CONSTRAINT "traction_rocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traction_vto" ADD CONSTRAINT "traction_vto_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_issue_same_tenant_fk" FOREIGN KEY ("tenant_id","issue_id") REFERENCES "public"."traction_issues"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "traction_entries_tenant_isolation" ON "traction_entries" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_issues_tenant_isolation" ON "traction_issues" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_measurables_tenant_isolation" ON "traction_measurables" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_meetings_tenant_isolation" ON "traction_meetings" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_rocks_tenant_isolation" ON "traction_rocks" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "traction_vto_tenant_isolation" ON "traction_vto" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);