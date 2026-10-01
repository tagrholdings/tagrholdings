import { z } from "zod";
import { insertPipelineItemSchema, boardColumnSchema } from "./pipeline.schema";

export const createPipelineItemSchema = insertPipelineItemSchema.pick({
  boardId: true,
  title: true,
  stage: true,
  contactId: true,
  organizationId: true,
  notes: true,
});

export type NewPipelineItem = z.infer<typeof createPipelineItemSchema>;

export const moveStageSchema = z.object({
  id: z.uuid(),
  stage: z.string().min(1).max(100),
});

export const updatePipelineItemSchema = createPipelineItemSchema.partial().extend({
  id: z.uuid(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  columns: z
    .array(boardColumnSchema.pick({ label: true }))
    .min(1, "Add at least one column.")
    .max(10, "Up to 10 columns."),
});

export type NewBoard = z.infer<typeof createBoardSchema>;

export const renameBoardSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Name is required.").max(100),
});

/**
 * Edit a project's stages: the full list in its new order. A stage that already exists carries its `id` (so its cards stay
 * in it, whatever it was renamed to); a stage without one is new. Existing stages left out of the list are removed — their
 * cards go to `moveRemovedTo`, which must be an existing stage that is kept.
 */
export const updateBoardColumnsSchema = z.object({
  id: z.uuid(),
  columns: z
    .array(z.object({ id: z.string().max(100).optional(), label: z.string().trim().min(1, "Name every stage.").max(60) }))
    .min(1, "Add at least one stage.")
    .max(10, "Up to 10 stages."),
  moveRemovedTo: z.string().max(100).optional(),
});

export type UpdateBoardColumns = z.infer<typeof updateBoardColumnsSchema>;

export const setBoardArchivedSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
});

export const deleteBoardSchema = z.object({
  id: z.uuid(),
});
