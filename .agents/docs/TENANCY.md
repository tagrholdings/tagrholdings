# Multi-Tenancy — Model and Expansion Plan

## Chosen model: shared `tenantId` column

Instead of separate databases or separate schemas per company, this project uses **a single Postgres database (Neon)**, with a `tenants` table and a `tenantId` column on every domain table (`organizations`, `contacts`, `pipeline_items`, `activities`, `raw_leads`, `search_profiles`).

Rationale for this choice: the end goal is for the group owner to see everything consolidated (Tagr Holdings + future Menlo Group units), which stays simple with a single table and `WHERE tenantId = ...`, and gets complicated with separate databases/schemas (no direct `JOIN` between them, schema migrations need to run N times).

## Current state

Today there is **a single active tenant**: Tagr Holdings. The code already treats everything as multi-tenant from the start (no query without a `tenantId` filter), even with only one tenant running — this avoids architectural rework once the second tenant is added.

## Expansion plan

When the project expands to the Menlo Group, the expectation is:

1. Each Menlo Group unit (CRE, Dental Transitions, Business Brokerage) becomes a new row in `tenants`.
2. Users may need access to more than one tenant (e.g. someone working across two units) — this isn't designed yet; when the time comes, evaluate a `user_tenants` join table instead of assuming 1 user = 1 tenant.
3. Custom fields per business type (each unit may evaluate leads/deals differently) — evaluate whether this becomes flexible JSON columns per tenant or fixed fields with slightly different meaning per context. Not decided yet — don't assume a solution in code before this is defined.

## Golden rule for any new code

If a table stores data that "belongs" to a company (it's not a global catalog shared by all tenants), it has `tenantId`, period. When in doubt, it has `tenantId`.
