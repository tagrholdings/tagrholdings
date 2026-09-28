CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "notify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_tenant_user_idx" ON "push_subscriptions" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE POLICY "push_subscriptions_tenant_isolation" ON "push_subscriptions" AS PERMISSIVE FOR ALL TO "app_tenant" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- Grants aren't managed by drizzle-kit (see 0004). The app (withTenant -> app_tenant) subscribes, unsubscribes and
-- prunes dead subscriptions; RLS above decides which rows. The new activities columns are covered by 0004's table-level grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO app_tenant;