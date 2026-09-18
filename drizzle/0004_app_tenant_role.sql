-- Role for tenant-scoped queries (see withTenant() in lib/db.ts and
-- .agents/docs/TENANCY.md). NOLOGIN + NOBYPASSRLS: the app keeps its normal
-- login and switches into this role inside each tenant transaction
-- (set_config('role', 'app_tenant', true)). That switch is what makes the
-- tenant RLS policies in the next migration apply at all — the login role
-- (neondb_owner) has BYPASSRLS, so policies alone would never filter anything.
-- Hand-written: drizzle-kit doesn't manage roles or grants in this project.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
-- The role running migrations is the app's login role; it must be allowed to
-- SET ROLE app_tenant. INHERIT FALSE: it never needs app_tenant's privileges
-- implicitly.
GRANT app_tenant TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_tenant;
--> statement-breakpoint
-- Only the tenant-owned tables. tenants, tenant_members and
-- rate_limit_buckets are deliberately absent: they're read through the
-- unscoped connection before a tenant is known.
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, contacts, pipeline_boards, pipeline_items, activities TO app_tenant;
