# Skill: Server Actions Writer

Use this skill whenever the request involves creating a mutation endpoint (something the user triggers via a button/form/drag-drop that changes data in the database).

## Structure

```ts
// modules/pipeline/pipeline.actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { moveItemStageSchema } from "./pipeline.schema";
import { pipelineService } from "./pipeline.service";

export const moveItemStageAction = protectedAction
  .schema(moveItemStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    await pipelineService.moveStage(ctx.user.tenantId, parsedInput.id, parsedInput.stage);
    revalidatePath("/pipeline/board");
    return { success: true };
  });
```

## Rules

- Every Action uses `protectedAction` (the `safe-action` wrapper) — never a bare `"use server"` function without the wrapper, because that skips authentication checks and error masking.
- `.schema(...)` always points to the Zod schema defined in `[domain].schema.ts` — never an inline duplicated `z.object` inside the actions file.
- `ctx.user.tenantId` is the only source of `tenantId` used here — never accept `tenantId` as a field on the input schema (see `architecture.md`, isolation rule 4).
- `revalidatePath`/`revalidateTag` after any mutation that affects an already-rendered screen — forgetting this is the most common cause of a "I saved it but it didn't show up" report from the user.
- Errors thrown in the Service are caught by `safe-action`: a `UserFacingError` (`lib/errors.ts`) reaches the client with its message, anything else with a generic message (a Drizzle error's message is the raw SQL + params). The Action doesn't need a manual `try/catch` around the Service call.
- An Action never calls the Repository directly, skipping the Service — even for an operation that "seems" simple enough not to need business logic. If there truly is no rule at all, the Service still exists as a thin pass-through layer (keeps the architecture predictable).
