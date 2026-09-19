"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { leadsService } from "./leads.service";
import { leadsIngestService } from "./leads-ingest.service";
import { promoteRawLeadSchema, quickAddLeadSchema, rawLeadIdSchema } from "./leads.types";

/** Promotion creates a card on /leads and may add an organization + contact, so all of those lists go stale. */
export const promoteRawLeadAction = protectedAction
  .schema(promoteRawLeadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const item = await leadsService.promote(ctx.user.tenantId, parsedInput.id, { title: parsedInput.title });
    revalidatePath("/leads-inbox");
    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { pipelineItemId: item.id };
  });

export const dismissRawLeadAction = protectedAction
  .schema(rawLeadIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await leadsService.dismiss(ctx.user.tenantId, parsedInput.id);
    revalidatePath("/leads-inbox");
    return { success: true };
  });

export const restoreRawLeadAction = protectedAction
  .schema(rawLeadIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await leadsService.restore(ctx.user.tenantId, parsedInput.id);
    revalidatePath("/leads-inbox");
    return { success: true };
  });

/**
 * Leads Inbox quick-add (a pasted link or text). The Server Action entry point of the same ingestion service
 * POST /api/leads/ingest uses — tenant from the session, never from the client.
 */
export const quickAddLeadAction = protectedAction
  .schema(quickAddLeadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await leadsIngestService.quickAdd(ctx.user.tenantId, parsedInput.input);
    revalidatePath("/leads-inbox");
    return result;
  });
