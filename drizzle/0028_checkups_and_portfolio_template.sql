CREATE TABLE "portfolio_scorecard_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cadence" text DEFAULT 'weekly' NOT NULL,
	"unit" text DEFAULT 'number' NOT NULL,
	"aggregation" text DEFAULT 'sum' NOT NULL,
	"goal_operator" text,
	"goal_value" numeric,
	"goal_value_max" numeric,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_scorecard_template_name_unique" UNIQUE("name"),
	CONSTRAINT "portfolio_scorecard_template_cadence_check" CHECK ("portfolio_scorecard_template"."cadence" in ('weekly', 'monthly')),
	CONSTRAINT "portfolio_scorecard_template_unit_check" CHECK ("portfolio_scorecard_template"."unit" in ('number', 'currency', 'percent')),
	CONSTRAINT "portfolio_scorecard_template_aggregation_check" CHECK ("portfolio_scorecard_template"."aggregation" in ('sum', 'average', 'latest')),
	CONSTRAINT "portfolio_scorecard_template_goal_operator_check" CHECK ("portfolio_scorecard_template"."goal_operator" is null or "portfolio_scorecard_template"."goal_operator" in ('gte', 'lte', 'eq', 'between'))
);
--> statement-breakpoint
CREATE TABLE "traction_checkups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"taken_at" timestamp DEFAULT now() NOT NULL,
	"taken_by_user_id" text,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"notes" text,
	CONSTRAINT "traction_checkups_score_check" CHECK ("traction_checkups"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "traction_checkups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "traction_checkups" ADD CONSTRAINT "traction_checkups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "traction_checkups_tenant_isolation" ON "traction_checkups" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);