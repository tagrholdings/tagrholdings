CREATE TABLE "platform_roles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_roles_role_check" CHECK ("platform_roles"."role" in ('super_admin'))
);
--> statement-breakpoint
DROP POLICY "push_subscriptions_tenant_isolation" ON "push_subscriptions" CASCADE;--> statement-breakpoint
ALTER TABLE "push_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_members" DROP CONSTRAINT "tenant_members_user_id_unique";--> statement-breakpoint
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk";
--> statement-breakpoint
DROP INDEX "push_subscriptions_tenant_user_idx";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
-- Everyone who had access before this migration was effectively an admin.
UPDATE "tenant_members" SET "role" = 'admin';--> statement-breakpoint
-- Added nullable, backfilled for any existing workspace (slug + random token), then made NOT NULL.
ALTER TABLE "tenants" ADD COLUMN "inbound_local_part" text;--> statement-breakpoint
UPDATE "tenants" SET "inbound_local_part" = "slug" || '-' || substr(md5(random()::text || "id"::text), 1, 8) WHERE "inbound_local_part" IS NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "inbound_local_part" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "buyer_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "buyer_phone" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "buyer_company" text;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "push_subscriptions" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_user_unique" UNIQUE("tenant_id","user_id");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_inbound_local_part_unique" UNIQUE("inbound_local_part");--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_role_check" CHECK ("tenant_members"."role" in ('admin', 'member'));--> statement-breakpoint
-- Grants aren't managed by drizzle-kit (see 0004). The lead engine (lead_scraper) now reads, per workspace, the
-- address its email signups use and who they sign up as — only those columns of `tenants`, nothing else.
GRANT SELECT ("id", "inbound_local_part", "buyer_name", "buyer_phone", "buyer_company") ON "tenants" TO lead_scraper;
