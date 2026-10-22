import { z } from "zod";
import { ACTIVITY_PRIORITIES, ACTIVITY_TYPES } from "@/modules/activities/activities.types";

/** The fields of an activity the bot fills in. `dueDate` is ISO 8601 text — it travels through jsonb and the model. */
export const proposalFieldsSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1).max(200),
  dueDate: z.string().nullish(),
  timezone: z.string().nullish(),
  priority: z.enum(ACTIVITY_PRIORITIES).nullish(),
  notes: z.string().trim().max(10_000).nullish(),
  contactId: z.uuid().nullish(),
  organizationId: z.uuid().nullish(),
  pipelineItemId: z.uuid().nullish(),
  assignedToPersonId: z.uuid().nullish(),
  assignedToContactId: z.uuid().nullish(),
  /** Never offered to the model: an edit keeps the Rock the activity already moves forward. */
  rockId: z.uuid().nullish(),
  notify: z.boolean().nullish(),
});

export type ProposalFields = z.infer<typeof proposalFieldsSchema>;

/** Human names for the ids in a proposal, so the card reads "Assigned to Maria", not a uuid. */
export interface ProposalLabels {
  assignee?: string | null;
  pipelineItem?: string | null;
  contact?: string | null;
  organization?: string | null;
}

export type PendingPayload =
  | { kind: "create"; fields: ProposalFields; labels: ProposalLabels }
  | { kind: "update"; id: string; fields: ProposalFields; labels: ProposalLabels; was: string }
  | { kind: "complete"; id: string; subject: string; done: boolean };

export type PendingKind = PendingPayload["kind"];

/** What the agent decided to do with a message. */
export type AgentOutcome =
  | { kind: "propose"; payload: PendingPayload }
  | { kind: "reply"; text: string }
  /** Not meant for the bot (chatter between people in the command channel): say nothing. */
  | { kind: "ignore" };

/** A voice note or other audio the person sent. */
export interface AudioInput {
  mimeType: string;
  /** Base64. */
  data: string;
}

export interface AgentInput {
  text: string;
  audio?: AudioInput;
  /** The person's own time zone (Slack profile) — "Friday at 2pm" means 2pm there. */
  timeZone: string;
  now: Date;
}

/** Workspace-level Slack settings, edited by an admin. Both ids are shown in Slack's own UI (copy link / About). */
export const slackSettingsSchema = z.object({
  slackTeamId: z
    .string()
    .trim()
    .regex(/^T[A-Z0-9]{6,}$/, "That doesn't look like a Slack workspace ID (starts with T)."),
  commandChannelId: z
    .string()
    .trim()
    .regex(/^[CG][A-Z0-9]{6,}$/, "That doesn't look like a Slack channel ID (starts with C or G).")
    .or(z.literal(""))
    .optional(),
});

export type SlackSettingsInput = z.input<typeof slackSettingsSchema>;

// -- Slack's payloads (only what we read) -------------------------------------------------------------------------------

export interface SlackFile {
  id: string;
  name?: string;
  mimetype?: string;
  size?: number;
  url_private_download?: string;
  url_private?: string;
}

export interface SlackMessageEvent {
  type: "message" | "app_mention";
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  channel: string;
  files?: SlackFile[];
}

export interface SlackEventCallback {
  type: "event_callback";
  team_id: string;
  api_app_id: string;
  event_id?: string;
  event: SlackMessageEvent | { type: string };
}

export interface SlackInteractionPayload {
  type: string;
  user?: { id?: string };
  team?: { id?: string };
  api_app_id?: string;
  channel?: { id?: string };
  message?: { ts?: string };
  actions?: { action_id?: string; value?: string }[];
}
