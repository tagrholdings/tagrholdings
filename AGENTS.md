<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TAGR CRM — Agent Instructions

> **Read FIRST. This is the project's master index.** Detailed rules live in `rules/`, skills in `skills/`. This file connects everything and resolves ambiguity.
> Only check 'rules' and 'skills' when actually needed.

Project: internal CRM for Tagr Holdings (Phoenix, AZ), with a planned future multi-tenant expansion to the Menlo Group business units (CRE, Dental Transitions, Business Brokerage). Fed by a lead-discovery engine (scraper + APIs) that runs as a separate job and writes to the same database.

---

## 🚫 What to NEVER Do (Anti-Patterns)

1. **NEVER** use `"use client"` in `page.tsx` or `layout.tsx`.
2. **NEVER** access one module's Repository from another module. Use the Service.
3. **NEVER** return raw database errors to the client. Use Error Masking via `safe-action.ts`.
4. **NEVER** write business logic in Hooks, Components, or Actions.
6. **NEVER** use shadows on components.
7. **NEVER** create global folders like `/services` or `/repositories`. Use Vertical Slicing in `/modules/`.
8. **NEVER** fetch data directly in a Client Component (unless encapsulated in SWR).
9. **NEVER** show an `authClient` failure with inline state (`setLocalError`) — always `notify.error()` (Toast). ~~`authClient` returns an `AuthResult` and never throws~~ — corrected 2026-09-17: verified against a real failed sign-in on `@neondatabase/auth`, which **does** reject (`AuthApiError`) instead of resolving `{ error }`. Wrap the call in `try/catch` and route both the caught error and a resolved `{ error }` to `notify.error()` — see `app/auth/sign-in/_components/SignInForm.tsx` for the pattern. The "never inline error state" half of this rule still holds.
10. **NEVER** `fetch("/api/auth/...")` directly from the frontend. Use Server Actions via `authClient`.
11. **NEVER** manage complex form state manually with `useState`. Use **React Hook Form** + **Zod** for validation and consistency. (Tip: use `z.input<typeof schema>` to export form types and avoid errors with `.default()` fields.)
12. **NEVER** run a Repository or Service query without filtering by `tenantId`. This is the multi-tenant isolation rule — a query missing this filter is a data-leak bug between companies (Tagr vs. future Menlo Group units).

---

## 🏗️ Architecture: Thin Client, Fat Server

```
Client = "Dumb" → Renders UI + captures user intent
Server = "Fat"  → All intelligence, tenant isolation, business rules
```

### The "Sandwich" Pattern (Data Flow)

```
1. Server (Read)     → page.tsx fetches data via Service
2. Client (Interact) → page.tsx passes data as props to _components/
3. Server (Write)    → Client Component calls a Server Action for mutations
```

### Full Canonical Example — moving a pipeline item to another stage

```
app/(hub)/pipeline/board/
├── page.tsx                     ← RSC: fetches pipeline items via Service
└── _components/
    ├── PipelineBoard.tsx        ← "use client": kanban with dnd-kit, calls Actions
    └── EditPipelineItemVault.tsx ← "use client": edit Vault, calls Actions

modules/pipeline/
├── pipeline.schema.ts           ← Drizzle tables + Zod via drizzle-zod
├── pipeline.repository.ts       ← Pure queries (db.query, db.insert), always filtered by tenantId
├── pipeline.service.ts          ← Tenant isolation + business rules
├── pipeline.actions.ts          ← Zod validation + safe-action wrapper
└── pipeline.types.ts            ← Exported types
```

#### page.tsx (RSC — NEVER "use client")
```tsx
// app/(hub)/pipeline/board/page.tsx
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { getCurrentUser } from "@/lib/auth-server";
import { PipelineBoard } from "./_components/PipelineBoard";

export default async function PipelineBoardPage() {
  const user = await getCurrentUser();
  const items = await pipelineService.getBoardItems(user.tenantId);
  return <PipelineBoard initialData={items} />;
}
```

#### Client Component (_components/ — "use client" goes here)
```tsx
// app/(hub)/pipeline/board/_components/PipelineBoard.tsx
"use client";
import { moveItemStageAction } from "@/modules/pipeline/pipeline.actions";
import { notify } from "@/components/ui/toaster";

export function PipelineBoard({ initialData }) {
  const handleDrop = async (itemId: string, newStage: string) => {
    const result = await moveItemStageAction({ itemId, newStage });
    if (result.success) notify.success("Moved!");
    else notify.error(result.error);
  };
  return (/* kanban with dnd-kit, columns per stage, calls handleDrop on drop */);
}
```

#### Server Action (Gatekeeper — thin, no logic)
```tsx
// modules/pipeline/pipeline.actions.ts
"use server";
import { protectedAction } from "@/lib/safe-action";
import { moveItemStageSchema } from "./pipeline.schema";
import { pipelineService } from "./pipeline.service";

export const moveItemStageAction = protectedAction
  .schema(moveItemStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    await pipelineService.moveStage(ctx.user.tenantId, parsedInput.itemId, parsedInput.newStage);
    revalidatePath("/pipeline/board");
    return { success: true };
  });
```

#### Service (The Heart — all the intelligence lives here)
```tsx
// modules/pipeline/pipeline.service.ts
import { pipelineRepository } from "./pipeline.repository";

export const pipelineService = {
  async moveStage(tenantId: string, itemId: string, newStage: string) {
    const item = await pipelineRepository.findById(tenantId, itemId);
    if (!item) throw new Error("Item not found"); // tenant isolation built into the query
    await pipelineRepository.updateStage(tenantId, itemId, newStage);
  },
};
```

#### Repository (Pure DB access — no logic, no checks, always tenant-filtered)
```tsx
// modules/pipeline/pipeline.repository.ts
import { db } from "@/lib/db";
import { pipelineItemsTable } from "./pipeline.schema";
import { and, eq } from "drizzle-orm";

export const pipelineRepository = {
  async findById(tenantId: string, id: string) {
    return db.query.pipelineItemsTable.findFirst({
      where: and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)),
    });
  },
  async updateStage(tenantId: string, id: string, stage: string) {
    await db.update(pipelineItemsTable).set({ stage })
      .where(and(eq(pipelineItemsTable.tenantId, tenantId), eq(pipelineItemsTable.id, id)));
  },
};
```

---

## 📐 Detailed Rules (References)

The full rules live in separate files. **Read them when implementing:**

| File | Content | When to read |
|---|---|---|
| `.agents/rules/architecture.md` | Thin/Fat paradigm, tenant isolation, security | Always |
| `.agents/rules/structure.md` | Sandwich pattern, RSC rules, Client Components, Server Actions, directories | Always |
| `.agents/rules/primitives.md` | What each layer DOES and DOES NOT do (Repository, Service, Action, Hook, Component) | When creating any file |
| `.agents/rules/design.md` | Minimalism, Kanban/dnd-kit, theming | When creating UI |
| `.agents/rules/lead-pipeline.md` | How the scraping/AI job writes raw leads and how the CRM consumes them | When touching lead ingestion |

---

## 📚 Project Context (Documentation)

| File | Content | When to read |
|---|---|---|
| `.agents/docs/TENANCY.md` | Multi-tenant model via `tenantId` — isolation rules, Menlo Group expansion plan | When implementing any query or Service |
| `.agents/docs/LEAD_INGESTION.md` | Contract between the Python job (scraper + AI extraction) and the `raw_leads` schema | When integrating data coming from the scraper |
| `.agents/docs/DOMAINS.md` | Why `www.tagrholdings.com` (marketing) and `crm.tagrholdings.com` (hub) are one deployment split by `proxy.ts`, and the trade-offs that come with it | When adding a route, touching `proxy.ts`, or debugging cross-domain/auth-redirect behavior |

---

## 🛠️ Skills — Which One to Use

Each skill is a specialized manual. **Use the skill matching the type of file you're creating:**

| When the request involves... | Skill | File |
|---|---|---|
| Creating/altering tables or validations | **Model & Schema** | `.agents/skills/model-writer.md` |
| Implementing business rules, tenant isolation | **Service Layer** | `.agents/skills/service-writer.md` |
| Creating a mutation endpoint (Server Action) | **Server Actions** | `.agents/skills/action-writer.md` |
| UI logic, fetching, state, kanban drag-and-drop | **UI Hooks** | `.agents/skills/hook-writer.md` |
| Lead-ingestion webhooks, external integrations (Resend, scraper) | **External Boundaries** | `.agents/skills/route-writer.md` |
| Unit tests | **Testing** | `.agents/skills/test-writer.md` |
| Deploying to Vercel, GitHub Actions/server jobs | **Infrastructure & Deploy** | `.agents/skills/deploy-manager.md` |

---

## 📏 Naming Conventions

```
modules/[domain]/[domain].schema.ts      → Drizzle tables + Zod
modules/[domain]/[domain].repository.ts  → Pure queries (always with tenantId)
modules/[domain]/[domain].service.ts     → Business logic + tenant isolation
modules/[domain]/[domain].actions.ts     → Server Actions (gatekeeper)
modules/[domain]/[domain].types.ts       → Shared types

app/(hub)/[feature]/page.tsx             → RSC (NEVER "use client")
app/(hub)/[feature]/_components/         → Route-local Client Components

hooks/use[Name].ts                       → UI logic (SWR, Zustand)
components/ui/                           → Design system (Shadcn) — minimalist, no shadows
components/layout/                       → Header, Sidebar, Navigation

lib/                                     → Global singletons and configs (db, auth-server, safe-action)
utils/                                   → Pure functions (date, format, sanitize)
```

---

## ⚡ Quick Reference: Layers and Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│ page.tsx (RSC)          → Fetches data, checks session + tenant │
│   └─ _components/*.tsx  → "use client", renders, calls Actions  │
│        └─ Action        → Validates Zod, gets user/tenant, calls Service │
│             └─ Service  → Tenant isolation, business rules, orchestrates │
│                  └─ Repository → Pure Drizzle queries, tenant-filtered │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Knows Next.js? | Knows the DB? | Has Business Logic? |
|---|---|---|---|
| page.tsx | ✅ | Via Service | ❌ |
| _components/ | ✅ | ❌ | ❌ |
| Action | ✅ (revalidate) | ❌ | ❌ |
| Service | ❌ | Via Repository | ✅ |
| Repository | ❌ | ✅ (Drizzle) | ❌ |
| Hook | ✅ | ❌ | ❌ |