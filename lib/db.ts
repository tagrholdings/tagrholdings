import "server-only";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as tenancySchema from "@/modules/tenancy/tenancy.schema";
import * as organizationsSchema from "@/modules/organizations/organizations.schema";
import * as contactsSchema from "@/modules/contacts/contacts.schema";
import * as pipelineSchema from "@/modules/pipeline/pipeline.schema";
import * as activitiesSchema from "@/modules/activities/activities.schema";
import * as searchProfilesSchema from "@/modules/search-profiles/search-profiles.schema";
import * as leadsSchema from "@/modules/leads/leads.schema";
import * as leadEngineSchema from "@/modules/lead-engine/lead-engine.schema";
import * as emailSourcesSchema from "@/modules/email-sources/email-sources.schema";
import * as rateLimitSchema from "@/modules/rate-limit/rate-limit.schema";

const schema = {
  ...tenancySchema,
  ...organizationsSchema,
  ...contactsSchema,
  ...pipelineSchema,
  ...activitiesSchema,
  ...searchProfilesSchema,
  ...leadsSchema,
  ...leadEngineSchema,
  ...emailSourcesSchema,
  ...rateLimitSchema,
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

/**
 * Unscoped connection — the login role has BYPASSRLS, so RLS policies don't
 * apply here. Only for tables without a `tenant_id` (tenancy lookups, rate
 * limiting). Tenant-owned tables go through `withTenant` instead; ESLint
 * blocks importing `db` from those modules' repositories.
 */
export const db = drizzle(pool, { schema });

export type TenantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The NOLOGIN, NOBYPASSRLS role the tenant RLS policies target — see drizzle/0004_app_tenant_role.sql. */
export const TENANT_ROLE = "app_tenant";

/**
 * Runs `fn` in a transaction scoped to one tenant: switches to the
 * `app_tenant` role (no BYPASSRLS) and sets `app.tenant_id`, so Postgres
 * row-level security filters every row the queries touch — including JOINed
 * tables — to that tenant. Both settings are transaction-local
 * (`set_config(..., true)`), so they never leak to the next user of a pooled
 * connection. This is a second layer under the `tenantId` filter every
 * repository query still carries, not a replacement for it.
 */
export function withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('role', ${TENANT_ROLE}, true), set_config('app.tenant_id', ${tenantId}, true)`
    );
    return fn(tx);
  });
}
