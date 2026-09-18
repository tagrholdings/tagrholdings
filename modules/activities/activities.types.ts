import { z } from "zod";
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

export const createActivitySchema = insertActivitySchema
  .pick({
    type: true,
    subject: true,
    dueDate: true,
    priority: true,
    notes: true,
    contactId: true,
    organizationId: true,
    pipelineItemId: true,
    assignedToUserId: true,
    assignedToContactId: true,
  })
  .extend({
    type: z.enum(ACTIVITY_TYPES),
    priority: z.enum(ACTIVITY_PRIORITIES).nullish(),
  })
  .refine((data) => !(data.assignedToUserId && data.assignedToContactId), {
    message: "Assign to either a team member or a contact, not both.",
    path: ["assignedToUserId"],
  });

export type NewActivity = z.infer<typeof createActivitySchema>;

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
  assignedToUserId: string | null;
  assignedToContactId: string | null;
  assignedToContactName: string | null;
}
