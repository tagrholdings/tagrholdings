"use server";

import { after } from "next/server";
import { z } from "zod";
import { revalidateWorkspace } from "@/lib/revalidate";
import { notificationsService } from "@/modules/notifications/notifications.service";
import { adminAction, protectedAction } from "@/lib/safe-action";
import { EOS_CHECKUP_STATEMENTS } from "@/lib/eos-checkup";
import { portfolioService } from "@/modules/portfolio/portfolio.service";
import { tractionService } from "./traction.service";
import {
  archiveMeasurableSchema,
  checkupIdSchema,
  closeOutRockSchema,
  concludeMeetingSchema,
  createIssueSchema,
  createMeasurableSchema,
  createProcessSchema,
  createRockSchema,
  createSeatSchema,
  createTodoSchema,
  deleteRockSchema,
  issueIdSchema,
  processIdSchema,
  rateMeetingSchema,
  reorderIssuesSchema,
  resolveIssueSchema,
  saveCheckupSchema,
  saveL10ScheduleSchema,
  saveReviewSchema,
  saveVtoSchema,
  seatIdSchema,
  setEntrySchema,
  setRockStatusSchema,
  startMeetingSchema,
  updateIssueSchema,
  updateMeasurableSchema,
  updateProcessSchema,
  updateRockSchema,
  updateSeatSchema,
} from "./traction.types";

/** Every Traction/EOS page reads a bit of everything (the Overview and the L10 read most of it), so a change refreshes them all. */
function revalidateTraction(slug: string) {
  revalidateWorkspace(
    slug,
    "/traction",
    "/traction/scorecard",
    "/traction/rocks",
    "/traction/issues",
    "/traction/l10",
    "/traction/l10/history",
    "/eos/vision",
    "/eos/people",
    "/eos/process",
    "/eos/checkup"
  );
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

export const closeOutRockAction = protectedAction.schema(closeOutRockSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.closeOutRock(ctx.user.tenantId, parsedInput.id, parsedInput.action);
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

export const resolveIssueAction = protectedAction.schema(resolveIssueSchema).action(async ({ parsedInput, ctx }) => {
  const { todos } = await tractionService.resolveIssue(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/activities");
  after(() => notificationsService.notifyAssigned(ctx.user.tenantId, ctx.workspace.slug, todos, ctx.user));
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
  const todo = await tractionService.createTodo(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/activities");
  after(() => notificationsService.notifyAssigned(ctx.user.tenantId, ctx.workspace.slug, [todo], ctx.user));
  return { success: true };
});

export const startMeetingAction = protectedAction.schema(startMeetingSchema).action(async ({ ctx }) => {
  const meeting = await tractionService.startMeeting(ctx.user.tenantId, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { meeting };
});

export const rateMeetingAction = protectedAction.schema(rateMeetingSchema).action(async ({ parsedInput, ctx }) => {
  const meeting = await tractionService.rateMeeting(ctx.user.tenantId, parsedInput, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { meeting };
});

export const concludeMeetingAction = protectedAction.schema(concludeMeetingSchema).action(async ({ parsedInput, ctx }) => {
  const meeting = await tractionService.concludeMeeting(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { meeting };
});

/** The standing L10 time decides when everyone is reminded — a workspace admin's call. */
export const saveL10ScheduleAction = adminAction.schema(saveL10ScheduleSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.saveL10Schedule(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── V/TO ─────────────

export const saveVtoAction = protectedAction.schema(saveVtoSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.saveVto(ctx.user.tenantId, parsedInput.content, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── People ─────────────

/** The Accountability Chart decides who manages whom (and so who reviews whom) — admins shape it. */
export const createSeatAction = adminAction.schema(createSeatSchema).action(async ({ parsedInput, ctx }) => {
  const seat = await tractionService.createSeat(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/contacts");
  return { seat };
});

export const updateSeatAction = adminAction.schema(updateSeatSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.updateSeat(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/contacts");
  return { success: true };
});

export const deleteSeatAction = adminAction.schema(seatIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.deleteSeat(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  revalidateWorkspace(ctx.workspace.slug, "/contacts");
  return { success: true };
});

/** Who may save which review is decided in the service (the person, their manager, or an admin). */
export const saveReviewAction = protectedAction.schema(saveReviewSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.saveReview(ctx.user.tenantId, parsedInput, ctx.user.id, ctx.workspace.role === "admin");
  revalidateWorkspace(ctx.workspace.slug, "/eos/people");
  return { success: true };
});

// ───────────── Process ─────────────

export const createProcessAction = protectedAction.schema(createProcessSchema).action(async ({ parsedInput, ctx }) => {
  const process = await tractionService.createProcess(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { process };
});

export const updateProcessAction = protectedAction.schema(updateProcessSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.updateProcess(ctx.user.tenantId, parsedInput);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const markProcessReviewedAction = protectedAction.schema(processIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.markProcessReviewed(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

export const deleteProcessAction = protectedAction.schema(processIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.deleteProcess(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── Organizational Checkup ─────────────

export const saveCheckupAction = protectedAction.schema(saveCheckupSchema).action(async ({ parsedInput, ctx }) => {
  const checkup = await tractionService.saveCheckup(ctx.user.tenantId, parsedInput, EOS_CHECKUP_STATEMENTS.length, ctx.user.id);
  revalidateTraction(ctx.workspace.slug);
  return { checkup };
});

/** Deleting a record of the company's state is an admin's call (e.g. one taken by mistake). */
export const deleteCheckupAction = adminAction.schema(checkupIdSchema).action(async ({ parsedInput, ctx }) => {
  await tractionService.deleteCheckup(ctx.user.tenantId, parsedInput.id);
  revalidateTraction(ctx.workspace.slug);
  return { success: true };
});

// ───────────── The portfolio's standard measurables ─────────────

/** Adds the portfolio's standard measurables this workspace is missing (each company then sets their owners). */
export const addStandardMeasurablesAction = protectedAction.schema(z.object({})).action(async ({ ctx }) => {
  const added = await tractionService.addStandardMeasurables(ctx.user.tenantId, await portfolioService.getTemplate());
  revalidateTraction(ctx.workspace.slug);
  return { added };
});
