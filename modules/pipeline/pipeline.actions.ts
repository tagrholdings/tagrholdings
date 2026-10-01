"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { pipelineService } from "./pipeline.service";
import {
  createBoardSchema,
  createPipelineItemSchema,
  deleteBoardSchema,
  moveStageSchema,
  renameBoardSchema,
  setBoardArchivedSchema,
  updateBoardColumnsSchema,
  updatePipelineItemSchema,
} from "./pipeline.types";

/** Pipeline items show up on Projects, Leads, a contact's panel, and as activity links. */
function revalidatePipelinePages(slug: string) {
  revalidateWorkspace(slug, "/pipeline");
  revalidateWorkspace(slug, "/leads");
  revalidateWorkspace(slug, "/contacts");
  revalidateWorkspace(slug, "/activities");
}

export const createBoardAction = protectedAction
  .schema(createBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.createBoard(ctx.user.tenantId, parsedInput);
    revalidateWorkspace(ctx.workspace.slug, "/pipeline");
    return { board };
  });

export const renameBoardAction = protectedAction
  .schema(renameBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.renameBoard(ctx.user.tenantId, parsedInput.id, parsedInput.name);
    revalidatePipelinePages(ctx.workspace.slug);
    return { board };
  });

export const updateBoardColumnsAction = protectedAction
  .schema(updateBoardColumnsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.updateBoardColumns(ctx.user.tenantId, parsedInput);
    revalidatePipelinePages(ctx.workspace.slug);
    return { board };
  });

export const setBoardArchivedAction = protectedAction
  .schema(setBoardArchivedSchema)
  .action(async ({ parsedInput, ctx }) => {
    const board = await pipelineService.setBoardArchived(ctx.user.tenantId, parsedInput.id, parsedInput.archived);
    revalidatePipelinePages(ctx.workspace.slug);
    return { board };
  });

export const deleteBoardAction = protectedAction
  .schema(deleteBoardSchema)
  .action(async ({ parsedInput, ctx }) => {
    await pipelineService.deleteBoard(ctx.user.tenantId, parsedInput.id);
    revalidatePipelinePages(ctx.workspace.slug);
    return { id: parsedInput.id };
  });

export const createPipelineItemAction = protectedAction
  .schema(createPipelineItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    const item = await pipelineService.create(ctx.user.tenantId, parsedInput);
    revalidatePipelinePages(ctx.workspace.slug);
    return { item };
  });

export const moveStageAction = protectedAction
  .schema(moveStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const item = await pipelineService.moveStage(ctx.user.tenantId, parsedInput.id, parsedInput.stage);
    revalidatePipelinePages(ctx.workspace.slug);
    return { item };
  });

export const updatePipelineItemAction = protectedAction
  .schema(updatePipelineItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const item = await pipelineService.update(ctx.user.tenantId, id, data);
    revalidatePipelinePages(ctx.workspace.slug);
    return { item };
  });
