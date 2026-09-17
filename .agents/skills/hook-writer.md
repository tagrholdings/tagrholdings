# Skill: UI Hooks Writer

Use this skill whenever the request involves reusable UI logic: client-side fetching, derived state, debouncing, drag-and-drop integration.

## When a Hook is appropriate

- A Client Component needs to fetch/revalidate data on the client (e.g. unread-leads counter in the sidebar, updating without a page reload) → Hook with SWR.
- State logic repeated across more than one component (e.g. managing kanban drag-and-drop state) → Hook.
- Simple, one-off logic used inside a single component → doesn't need a separate Hook, can stay inline in the component.

## Structure (example: unread leads counter)

```ts
// hooks/useUnreadLeadsCount.ts
"use client";
import useSWR from "swr";
import { getUnreadLeadsCountAction } from "@/modules/leads/leads.actions";

export function useUnreadLeadsCount() {
  const { data, isLoading } = useSWR("unread-leads-count", async () => {
    const result = await getUnreadLeadsCountAction();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }, { refreshInterval: 30_000 });

  return { count: data ?? 0, isLoading };
}
```

## Rules

- A Hook never decides business rules about the result — it only exposes state (`data`, `isLoading`, `error`) and maybe an action function (`refetch`, `mutate`). The decision of "what this data means" already came ready-made from the Service through the Action.
- Hooks that call Server Actions always handle the standardized return shape (`{ success, error }` or `{ success, data }`) — never assume the call can't fail.
- Drag-and-drop hooks (dnd-kit) stay next to the kanban component that uses them (`_components/PipelineBoard.tsx` or a local `_components/usePipelineDnd.ts`), not in the global `hooks/` folder, unless the same drag-and-drop behavior is reused across more than one screen.
