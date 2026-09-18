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

export const setBoardArchivedSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
});

export const deleteBoardSchema = z.object({
  id: z.uuid(),
});
