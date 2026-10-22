CREATE TABLE "slack_installations" (
	"slack_team_id" text NOT NULL,
	"api_app_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"command_channel_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_installations_slack_team_id_api_app_id_pk" PRIMARY KEY("slack_team_id","api_app_id")
);
--> statement-breakpoint
CREATE TABLE "slack_message_claims" (
	"api_app_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_ts" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_message_claims_api_app_id_channel_id_message_ts_pk" PRIMARY KEY("api_app_id","channel_id","message_ts")
);
--> statement-breakpoint
CREATE TABLE "slack_pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slack_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"channel_id" text NOT NULL,
	"card_ts" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_pending_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "slack_user_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slack_user_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_user_links_tenant_slack_user_unique" UNIQUE("tenant_id","slack_user_id")
);
--> statement-breakpoint
ALTER TABLE "slack_user_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_pending_actions" ADD CONSTRAINT "slack_pending_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_user_links" ADD CONSTRAINT "slack_user_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_installations_tenant_idx" ON "slack_installations" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "slack_pending_actions_tenant_isolation" ON "slack_pending_actions" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "slack_user_links_tenant_isolation" ON "slack_user_links" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);