# Multi-Tenancy — Model and Expansion Plan

## Chosen model: shared `tenantId` column

Instead of separate databases or separate schemas per company, this project uses **a single Postgres database (Neon)**, with a `tenants` table and a `tenantId` column on every domain table (`organizations`, `contacts`, `pipeline_items`, `activities`, `raw_leads`, `search_profiles`).

Rationale for this choice: the end goal is for the group owner to see everything consolidated (Tagr Holdings + future Menlo Group units), which stays simple with a single table and `WHERE tenantId = ...`, and gets complicated with separate databases/schemas (no direct `JOIN` between them, schema migrations need to run N times).

## Enforcement — three layers

A `WHERE tenantId = ...` that someone forgets is a data leak between companies, so isolation doesn't rest on that filter alone:

1. **Application filter.** Every Repository query still filters by `tenantId` (AGENTS.md rule #12). This is the layer you read in code review.
2. **Composite foreign keys.** Every reference between tenant tables is `(tenant_id, x_id) → x(tenant_id, id)` — e.g. `pipeline_items (tenant_id, contact_id) → contacts (tenant_id, id)`, backed by `UNIQUE (tenant_id, id)` on each parent. Postgres itself rejects linking a row to another tenant's contact/organization/board/item, even if the ID came from a malicious request. (`activities.assigned_to_user_id` points at Neon Auth's `user` table, which can't be a FK target — `activitiesService.create` checks tenant membership instead.)
3. **Row-level security.** `organizations`, `contacts`, `pipeline_boards`, `pipeline_items`, `activities`, `search_profiles`, `raw_leads`, `lead_runs`, `lead_api_usage` and `email_sources` have RLS enabled with one policy each (`tenantIsolationPolicy()` in `tenancy.schema.ts`): the `app_tenant` role only sees and writes rows whose `tenant_id` equals the transaction's `app.tenant_id` setting. That also covers JOINed tables — a join can't surface another tenant's names.

### How RLS is wired

The app's login role (`neondb_owner`) has `BYPASSRLS` — Neon grants it to the owner and it can't be removed — so RLS policies alone would filter nothing. Instead, `withTenant(tenantId, (tx) => ...)` in `lib/db.ts` opens a transaction and runs:

```sql
select set_config('role', 'app_tenant', true), set_config('app.tenant_id', $1, true)
```

`app_tenant` is a `NOLOGIN NOBYPASSRLS` role (created in `drizzle/0004_app_tenant_role.sql`, which also grants the login role `SET` on it and grants `app_tenant` CRUD on the five tables above). Both settings are transaction-local, so nothing leaks to the next user of a pooled connection, and it works through Neon's PgBouncer (transaction pooling).

Rules that follow from this:

- **Tenant tables are only queried inside `withTenant`.** ESLint (`no-restricted-imports` in `eslint.config.mjs`) blocks importing the plain `db` in `modules/**`, except `tenancy` and `rate-limit`, whose tables carry no `tenant_id`.
- **Fail closed.** If `app.tenant_id` isn't set, the policy compares against NULL and returns no rows (no error) — a missing `withTenant` shows up as empty data, never as another tenant's data.
- **A new tenant table needs, in its migration:** `tenantIsolationPolicy("<table>")` in the Drizzle table definition (drizzle-kit emits `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`), `unique().on(t.tenantId, t.id)` if anything references it, composite `foreignKey()`s for its own references, and a hand-written `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO app_tenant` (drizzle-kit doesn't manage grants). Check the generated SQL: drizzle-kit has emitted composite FKs *before* the `UNIQUE` they reference — reorder if so.
- **Anything connecting as `neondb_owner` bypasses RLS**: the Neon console's SQL editor, `drizzle-kit studio` and the seed script. The Python lead-engine job is **not** one of them: it connects as its own `lead_scraper` role (`LOGIN NOBYPASSRLS`, `drizzle/0006` + grants in `0008`), sets `app.tenant_id` per transaction from the profile it's processing, and has policies of its own on `search_profiles`, `raw_leads`, `lead_runs` and `lead_api_usage` (helper: `scraperTenantPolicy()` in `tenancy.schema.ts`). Its one cross-tenant privilege is *reading active search profiles*. Details and the grant table in `LEAD_INGESTION.md`.
- The lead-engine tables (`search_profiles`, `raw_leads`, `lead_runs`, `lead_api_usage`, `email_sources`) follow the same rules as the others: `tenantIsolationPolicy()` for the app, composite `(tenant_id, x_id)` FKs, grants in a hand-written migration (least privilege: `app_tenant` may `SELECT`/`INSERT`/`UPDATE` `raw_leads` — the app now creates manual and inbound-email leads itself — `INSERT` usage rows, only `SELECT` runs, and has full CRUD on `email_sources`).
- **Postgres also checks an UPDATE's NEW row against SELECT policies.** A `lead_scraper` SELECT policy of `not subscribed and not captcha_protected` therefore rejected the very update that sets `captcha_protected = true` (found by running the job against the real database, fixed in migration 0012). When a role's policy filters on a column it may itself change, filter on the stable part only.
- To inspect tenant data *as* the app sees it from the SQL editor: `begin; select set_config('role','app_tenant',true), set_config('app.tenant_id','<uuid>',true); select ...; rollback;`

### Stronger option (not done yet)

`SET ROLE` can be undone by `RESET ROLE`, so RLS here protects against application bugs (a missing filter, an unchecked ID), not against arbitrary SQL execution — which the app doesn't allow anyway (Drizzle parameterizes everything). A dedicated `LOGIN NOBYPASSRLS` role for the app's `DATABASE_URL` would close that gap too, at the cost of a second credential to manage in Vercel.

## Current state

Today there is **a single active tenant**: Tagr Holdings. The code already treats everything as multi-tenant from the start (no query without a `tenantId` filter), even with only one tenant running — this avoids architectural rework once the second tenant is added.

## Expansion plan

When the project expands to the Menlo Group, the expectation is:

1. Each Menlo Group unit (CRE, Dental Transitions, Business Brokerage) becomes a new row in `tenants`.
2. Users may need access to more than one tenant (e.g. someone working across two units) — this isn't designed yet; when the time comes, evaluate a `user_tenants` join table instead of assuming 1 user = 1 tenant.
3. Custom fields per business type (each unit may evaluate leads/deals differently) — evaluate whether this becomes flexible JSON columns per tenant or fixed fields with slightly different meaning per context. Not decided yet — don't assume a solution in code before this is defined.

## Golden rule for any new code

If a table stores data that "belongs" to a company (it's not a global catalog shared by all tenants), it has `tenantId`, period. When in doubt, it has `tenantId`.
