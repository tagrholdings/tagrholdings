import { z } from "zod";
import { isValidTimeZone } from "@/modules/traction/traction.logic";
import { insertActivitySchema } from "./activities.schema";

export const ACTIVITY_TYPES = ["call", "meeting", "task", "email", "follow_up"] as const;
export const ACTIVITY_PRIORITIES = ["low", "medium", "high"] as const;

export const setActivityDoneSchema = z.object({
  id: z.uuid(),
  done: z.boolean(),
});

/** Drag a card to another day on /activities' week board — moves whichever date field the board is currently grouped by. */
export const updateActivityDateSchema = z.object({
  id: z.uuid(),
  field: z.enum(["dueDate", "createdAt"]),
  date: z.date(),
});

const activityFieldsSchema = insertActivitySchema
  .pick({
    type: true,
    subject: true,
    dueDate: true,
    timezone: true,
    priority: true,
    notes: true,
    contactId: true,
    organizationId: true,
    pipelineItemId: true,
    rockId: true,
    assignedToPersonId: true,
    assignedToContactId: true,
    notify: true,
  })
  .extend({
    type: z.enum(ACTIVITY_TYPES),
    priority: z.enum(ACTIVITY_PRIORITIES).nullish(),
    timezone: z.string().refine(isValidTimeZone, "Pick a real time zone.").nullish(),
  });

/** The rules both creating and editing an activity share. */
function withActivityRules<T extends z.ZodType<{ assignedToPersonId?: string | null; assignedToContactId?: string | null; notify?: boolean | null; dueDate?: Date | null }>>(schema: T) {
  return schema
    .refine((data) => !(data.assignedToPersonId && data.assignedToContactId), {
      message: "Assign to either a team member or a contact, not both.",
      path: ["assignedToPersonId"],
    })
    .refine((data) => !data.notify || !!data.dueDate, {
      message: "A notification needs a due date and time.",
      path: ["notify"],
    });
}

export const createActivitySchema = withActivityRules(activityFieldsSchema);

export type NewActivity = z.infer<typeof createActivitySchema>;

/** Traction's links on an activity: an L10 To-Do, and the issue it was created from. */
export interface ActivityLink {
  l10Todo?: boolean;
  issueId?: string | null;
}

/** Editing replaces every editable field: one the form left empty is cleared, not kept. */
export const updateActivitySchema = withActivityRules(activityFieldsSchema.extend({ id: z.uuid() }));

export type ActivityUpdate = z.infer<typeof updateActivitySchema>;

export const ACTIVITY_TYPE_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  call: "Call",
  meeting: "Meeting",
  task: "Task",
  email: "Email",
  follow_up: "Follow-up",
};

export const ACTIVITY_PRIORITY_LABELS: Record<(typeof ACTIVITY_PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Client-side row shape — mirrors activitiesRepository's `withRelationsSelection`. */
export interface ActivityRow {
  id: string;
  type: string;
  subject: string;
  dueDate: string | Date | null;
  /** The zone the due time was entered in; null when the activity has no time. */
  timezone: string | null;
  createdAt: string | Date;
  done: boolean;
  priority: string | null;
  notes: string | null;
  contactId: string | null;
  contactName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  pipelineItemId: string | null;
  pipelineItemTitle: string | null;
  /** The Rock this activity moves forward (Traction). */
  rockId: string | null;
  rockTitle: string | null;
  assignedToPersonId: string | null;
  assignedToContactId: string | null;
  assignedToContactName: string | null;
  /** A push reminder is set for the due date/time. */
  notify: boolean;
  /** An L10 To-Do (Traction). */
  l10Todo: boolean;
}
