"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/lib/safe-action";
import { pipelineService } from "./pipeline.service";
import {
  createBoardSchema,
  createPipelineItemSchema,
  deleteBoardSchema,
  moveStageSchema,
  renameBoardSchema,
  setBoardArchivedSchema,
  updatePipelineItemSchema,
} from "./pipeline.types";

/** Pipeline items show up on Projects, Leads, a contact's panel, and as activity links. */
function revalidatePipelinePages() {
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/contacts");
  revalidatePath("/activities");
}

export const createBoardAction = protectedAction
  .schema(createBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.createBoard(ctx.user.tenantId, parsedInput);
    revalidatePath("/pipeline");
    return { board };
  });

export const renameBoardAction = protectedAction
  .schema(renameBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.renameBoard(ctx.user.tenantId, parsedInput.id, parsedInput.name);
    revalidatePipelinePages();
    return { board };
  });

export const setBoardArchivedAction = protectedAction
  .schema(setBoardArchivedSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.setBoardArchived(ctx.user.tenantId, parsedInput.id, parsedInput.archived);
    revalidatePipelinePages();
    return { board };
  });

export const deleteBoardAction = protectedAction
  .schema(deleteBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    await pipelineService.deleteBoard(ctx.user.tenantId, parsedInput.id);
    revalidatePipelinePages();
    return { id: parsedInput.id };
  });

export const createPipelineItemAction = protectedAction
  .schema(createPipelineItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    const item = await pipelineService.create(ctx.user.tenantId, parsedInput);
    revalidatePipelinePages();
    return { item };
  });

export const moveStageAction = protectedAction
  .schema(moveStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const item = await pipelineService.moveStage(ctx.user.tenantId, parsedInput.id, parsedInput.stage);
    revalidatePipelinePages();
    return { item };
  });

export const updatePipelineItemAction = protectedAction
  .schema(updatePipelineItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const item = await pipelineService.update(ctx.user.tenantId, id, data);
    revalidatePipelinePages();
    return { item };
  });
