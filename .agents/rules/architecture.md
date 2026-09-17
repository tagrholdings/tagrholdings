# Architecture — Thin Client, Fat Server

## The paradigm

```
Client = "Dumb" → Renders UI + captures user intent
Server = "Fat"  → All intelligence, tenant isolation, business rules
```

No business logic in the browser. A Client Component only knows: what to show, what the user clicked, and which Server Action to call next. Every real decision (allowed/not allowed, correct/incorrect, what happens next) lives on the Server, inside the Service layer.

## Vertical Slicing, not Global Layers

This project organizes code by **domain**, not by technical type. There is no global `/services` folder with everything mixed together — each domain (e.g. pipeline, contacts) has its own complete vertical slice inside `modules/[domain]/`, with its own schema, repository, service, actions, and types.

Rationale: when a domain changes or is removed, you touch one folder. In a global layered architecture, a domain change forces you to hunt for files scattered across `/services`, `/repositories`, `/types`, and `/schemas` at the same time.

## Multi-tenant isolation (the most important security rule in this project)

The project starts out serving only Tagr Holdings, but was designed from day one to support multiple companies in the same database (`tenantId` on every relevant table), with a planned future expansion to the Menlo Group business units.

Non-negotiable rules:

1. **Every domain table has a `tenantId` column.** No exceptions, even if only one tenant exists in production today.
2. **Every Repository method that reads or writes domain data takes `tenantId` as its first parameter and uses it in the `where` clause.** A Repository method missing that filter is a security bug, not an acceptable shortcut.
3. **The Service decides what happens, but never bypasses the Repository's tenant filter.** A Service never calls a "generic" query without a tenant filter "to be faster".
4. **`tenantId` comes from the authenticated user on the Server, never from a field submitted by the Client.** Trusting a `tenantId` sent from the form/payload lets any user read/write another tenant's data just by changing the submitted value.
5. When adding a new table, the first question for the Model & Schema skill is: "does this table need `tenantId`?" — the answer is almost always yes, unless it's a truly global table (e.g. a catalog of activity types shared across all tenants).

## General security

- Database errors never leak to the client raw — always masked via `safe-action.ts` (see `action-writer.md`).
- Every mutation goes through Zod validation before reaching the Service.
- The Server is the only layer that knows about secrets (API keys, connection strings). The Client never receives these, not even indirectly through props.
