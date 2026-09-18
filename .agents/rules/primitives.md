# Primitives — What Each Layer DOES and DOES NOT Do

## Repository

**Does:**
- Pure queries via Drizzle, run inside `withTenant(tenantId, (tx) => tx.select()...)` from `lib/db.ts` so Postgres row-level security applies (see `.agents/docs/TENANCY.md`). The plain `db` is only for tables without a `tenant_id` (tenancy, rate-limit) — ESLint blocks it elsewhere in `modules/`.
- Always takes `tenantId` as a parameter and includes it in the `where` clause of every domain query — RLS is the second layer, not a replacement.
- Returns raw data (or `undefined`/`null` when not found) — no transforming, no business-rule validation.

**Does not:**
- Any permission or business-rule check ("can this user do this?", "can this item change stage?"). That's the Service's job.
- Any call to another module. A `pipeline` Repository never imports the `contacts` Repository — if it needs data from another domain, the Service is what orchestrates that.
- Any `try/catch` that swallows the error — lets it bubble up to the Service.

## Service

**Does:**
- All business logic and domain rules (e.g. "an item can't go back from 'Complete' to 'Planned'").
- Orchestrates calls to Repositories, including other modules' Repositories when needed (e.g. `pipeline.service` can call `contacts.repository` to validate that the linked contact exists).
- Guarantees tenant isolation across every flow — it's the last line of defense before data touches the database.
- Throws business errors with clear messages as `UserFacingError` from `lib/errors.ts` (`throw new UserFacingError("Item not found")`) — only that class's message reaches the user via `safe-action`; any other error (including a plain `Error`) becomes a generic "Something went wrong", because a Drizzle error's message contains the full SQL and its parameters.

**Does not:**
- Know about Next.js (no `revalidatePath`, no cookies, no headers — that's the Action's job).
- Validate input shape with Zod (that already happened in the Action before reaching here) — the Service assumes the input is already correctly shaped, and focuses purely on business rules.

## Server Action

**Does:**
- Validates input with the module's Zod schema.
- Gets the authenticated user and `tenantId` from context (`ctx.user`).
- Calls the right Service method, passing `tenantId` explicitly.
- Calls `revalidatePath`/`revalidateTag` when needed.
- Returns a standardized result via `protectedAction`/`safe-action` — never lets a raw database error leak to the client.

**Does not:**
- Contain inline business logic (`if (item.stage === "complete" && ...)` doesn't belong here — that's the Service's job).
- Run any direct database query — always through the Service.

## Hook (`hooks/use[Name].ts`)

**Does:**
- UI logic: encapsulated client-side fetching (SWR), derived state, debouncing, etc.
- Can call Server Actions, but doesn't decide business rules about the result — it just reacts (loading, error, revalidate).

**Does not:**
- Business logic. A Hook never decides "this card can be moved to this stage" — that decision already came ready-made from the Service through the Action.

## Component (`_components/`)

**Does:**
- Renders UI from props and local interaction state (open/closed, focused field, etc).
- Calls Server Actions (directly or via a Hook) in response to user events.
- Shows errors via `notify.error()`.

**Does not:**
- Fetch domain data directly (outside of SWR encapsulated in a Hook).
- Keep local business-error state to decide what to render — the Service/Action already returned the decision.
