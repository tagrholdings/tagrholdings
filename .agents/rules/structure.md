# Structure — The Sandwich Pattern and Directory Layout

## The Sandwich Pattern (Data Flow)

```
1. Server (Read)     → page.tsx fetches data via Service
2. Client (Interact) → page.tsx passes data as props to _components/
3. Server (Write)    → Client Component calls a Server Action for mutations
```

Every screen follows this three-layer flow. There's no direct client fetch (outside of cases wrapped in SWR for revalidation), and no mutation that skips a Server Action.

## RSC (React Server Component) Rules

- `page.tsx` and `layout.tsx` **NEVER** have `"use client"`. They're always Server Components — fetching data via Service, checking session and tenant, and passing everything down as props.
- Anything that needs interactivity (onClick, useState, drag-and-drop) goes inside `_components/`, marked with `"use client"`.
- A `page.tsx` never contains business logic — it only orchestrates: gets the user, calls the right Service, renders the Client Component with the data.

## Client Components (`_components/`)

- Live inside the route's folder, prefixed with `_` so they don't become a route (`_components/`, not a bare `components/` inside the route folder).
- Only do two things: render UI from props/local state, and call Server Actions in response to user events.
- Server Action errors are shown via `notify.error()` (toast) — never with local `useState` holding an error message.

## Server Actions

- Live in `modules/[domain]/[domain].actions.ts`, never inside `_components/`.
- Are "gatekeepers": validate input with Zod, get the user/tenant from context, call the Service, and return a standardized result (`{ success, error }` or similar via `safe-action`).
- Never contain business logic — if an Action starts having `if`s about domain rules, that logic belongs in the Service.

## Directory structure

```
app/(hub)/[feature]/page.tsx             → RSC (NEVER "use client"), served at crm.tagrholdings.com — see DOMAINS.md
app/(hub)/[feature]/_components/         → Route-local Client Components

modules/[domain]/[domain].schema.ts      → Drizzle tables + Zod
modules/[domain]/[domain].repository.ts  → Pure queries (always with tenantId)
modules/[domain]/[domain].service.ts     → Business logic + tenant isolation
modules/[domain]/[domain].actions.ts     → Server Actions (gatekeeper)
modules/[domain]/[domain].types.ts       → Shared types

hooks/use[Name].ts                       → UI logic (SWR, Zustand)
components/ui/                           → Design system (Shadcn) — minimalist, no shadows
components/layout/                       → Header, Sidebar, Navigation

lib/                                     → Global singletons and configs (db, auth-server, safe-action)
utils/                                   → Pure functions (date, format, sanitize)
```

There are no global `/services` or `/repositories` folders outside `modules/`. Each domain carries its own complete slice.
