"use server";

import { revalidateWorkspace } from "@/lib/revalidate";
import { protectedAction } from "@/lib/safe-action";
import { tractionService } from "./traction.service";
import {
  archiveMeasurableSchema,
  concludeMeetingSchema,
  createIssueSchema,
  createMeasurableSchema,
  createRockSchema,
  createTodoSchema,
  deleteRockSchema,
  issueIdSchema,
  reorderIssuesSchema,
  saveVtoSchema,
  setEntrySchema,
  setRockStatusSchema,
  solveIssueSchema,
  updateIssueSchema,
  updateMeasurableSchema,
  updateRockSchema,
} from "./traction.types";

/** Every Traction page reads a bit of everything (the Overview and the L10 read all of it), so a change refreshes them all. */
function revalidateTraction(slug: string) {
  revalidateWorkspace(slug, "/traction", "/traction/scorecard", "/traction/rocks", "/traction/issues", "/traction/l10");
}

// ───────────── Scorecard ─────────────

export const createMeasurableAction = protectedAction.schema(createMeasurableSchema).action(async ({ parsedInput, ctx }) => {
  const measurable = await tractionService.createMeasurable(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { measurable };
});

export const updateMeasurableAction = protectedAction.schema(updateMeasurableSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.updateMeasurable(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const archiveMeasurableAction = protectedAction.schema(archiveMeasurableSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.archiveMeasurable(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const setEntryAction = protectedAction.schema(setEntrySchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.setEntry(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── Rocks ─────────────

export const createRockAction = protectedAction.schema(createRockSchema).action(async ({ parsedInput, ctx }) => {
  const rock = await tractionService.createRock(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { rock };
});

export const updateRockAction = protectedAction.schema(updateRockSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.updateRock(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const setRockStatusAction = protectedAction.schema(setRockStatusSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.setRockStatus(ctx.user.tenantId, parsedInput.id, parsedInput.status);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const deleteRockAction = protectedAction.schema(deleteRockSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.deleteRock(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── Issues ─────────────

export const createIssueAction = protectedAction.schema(createIssueSchema).action(async ({ parsedInput, ctx }) => {
  const issue = await tractionService.createIssue(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { issue };
});

export const updateIssueAction = protectedAction.schema(updateIssueSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.updateIssue(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const solveIssueAction = protectedAction.schema(solveIssueSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.solveIssue(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/activities");
  return { success: true };
});

export const dropIssueAction = protectedAction.schema(issueIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.dropIssue(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const reopenIssueAction = protectedAction.schema(issueIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.reopenIssue(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const reorderIssuesAction = protectedAction.schema(reorderIssuesSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.reorderIssues(ctx.user.tenantId, parsedInput.ids);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const deleteIssueAction = protectedAction.schema(issueIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.deleteIssue(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── L10 ─────────────

export const createTodoAction = protectedAction.schema(createTodoSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.createTodo(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/activities");
  return { success: true };
});

export const concludeMeetingAction = protectedAction.schema(concludeMeetingSchema).action(async ({ parsedInput, ctx }) => {
  const meeting = await tractionService.concludeMeeting(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { meeting };
});

// ───────────── V/TO ─────────────

export const saveVtoAction = protectedAction.schema(saveVtoSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.saveVto(ctx.user.tenantId, parsedInput.content, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});
