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
  /** The board of a lead/project card, and the name of its stage. */
  board?: string | null;
  stage?: string | null;
  /** The card is on the Leads board (a lead), not on a project board. */
  isLead?: boolean;
}

/** A contact as the bot proposes it. Create and edit share the shape: an edit carries every field (the merge is done before). */
export const contactFieldsSchema = z.object({
  name: z.string().trim().min(1, "A contact needs a name.").max(200),
  email: z.email("That doesn't look like an email address.").max(254).nullish(),
  phone: z.string().trim().max(50).nullish(),
  organizationId: z.uuid().nullish(),
});
export type ContactFields = z.infer<typeof contactFieldsSchema>;

export const organizationFieldsSchema = z.object({
  name: z.string().trim().min(1, "A company needs a name.").max(200),
  website: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) address." }).max(2048).nullish(),
  notes: z.string().trim().max(10_000).nullish(),
});
export type OrganizationFields = z.infer<typeof organizationFieldsSchema>;

/** A team member as the bot proposes it (the same limits as the Team page's form). */
export const teamPersonFieldsSchema = z.object({
  name: z.string().trim().min(1, "A team member needs a name.").max(120),
  email: z.email("That doesn't look like an email address.").nullable(),
  title: z.string().trim().max(120).nullable(),
});

/** A card on a board: a lead (the Leads board) or an item of a project board. */
export const cardFieldsSchema = z.object({
  boardId: z.uuid(),
  title: z.string().trim().min(1, "A card needs a title.").max(200),
  stage: z.string().min(1).max(100),
  contactId: z.uuid().nullish(),
  organizationId: z.uuid().nullish(),
  notes: z.string().trim().max(10_000).nullish(),
});
export type CardFields = z.infer<typeof cardFieldsSchema>;

export type PendingPayload =
  | { kind: "create"; fields: ProposalFields; labels: ProposalLabels }
  | { kind: "update"; id: string; fields: ProposalFields; labels: ProposalLabels; was: string }
  | { kind: "complete"; id: string; subject: string; done: boolean }
  | { kind: "create_contact"; fields: ContactFields; labels: ProposalLabels }
  | { kind: "update_contact"; id: string; fields: ContactFields; labels: ProposalLabels; was: string }
  | { kind: "create_organization"; fields: OrganizationFields }
  | { kind: "update_organization"; id: string; fields: OrganizationFields; was: string }
  | { kind: "create_card"; fields: CardFields; labels: ProposalLabels }
  | { kind: "update_card"; id: string; fields: CardFields; labels: ProposalLabels; was: string }
  /** A dated line appended to a card's or a company's notes — or, for a contact (no notes column), logged as a finished activity. */
  | { kind: "add_note"; target: "card" | "company" | "contact"; id: string; label: string; text: string; activityType: (typeof ACTIVITY_TYPES)[number] }
  | { kind: "add_issue"; fields: { title: string; notes: string | null; issueType: "problem" | "idea" | "obstacle"; horizon: "short_term" | "long_term"; ownerPersonId: string | null }; labels: ProposalLabels }
  | { kind: "add_todo"; fields: { subject: string; assignedToPersonId: string; dueDate: string }; labels: ProposalLabels }
  /** A new member of the team (a person who owns tasks and issues; they need no login). */
  | { kind: "create_person"; fields: { name: string; email: string | null; title: string | null } };

/** What a person told the bot about being messaged directly. Only the sender's own row is ever changed. */
export interface NotificationPatch {
  remindDm?: boolean;
  l10Dm?: boolean;
  digestDm?: boolean;
  weeklyDm?: boolean;
}

export type PendingKind = PendingPayload["kind"];

/** What the agent decided to do with a message. */
export type AgentOutcome =
  | { kind: "propose"; payload: PendingPayload }
  | { kind: "reply"; text: string }
  /** Not meant for the bot (chatter between people in the command channel): say nothing. */
  | { kind: "ignore" }
  /** The sender chose what to be messaged about: applied at once (it only touches their own preferences) and answered with the new state. */
  | { kind: "settings"; patch: NotificationPatch };

/** A voice note or other audio the person sent. */
export interface AudioInput {
  mimeType: string;
  /** Base64. */
  data: string;
}

/** An earlier message of the same Slack thread: what the person said, and what the bot answered (cards included). */
export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentInput {
  text: string;
  /** The thread so far, oldest first, WITHOUT the message being answered. Empty outside a thread. */
  history?: HistoryTurn[];
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

/** A message as `conversations.replies` returns it. `app_id` marks the ones a Slack app (ours) posted. */
export interface SlackThreadMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  app_id?: string;
  text?: string;
  blocks?: unknown[];
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
  /** "block_actions" (a button) or "message_action" (a message shortcut). */
  type: string;
  /** For a shortcut: which one (the manifest's callback_id). */
  callback_id?: string;
  user?: { id?: string };
  team?: { id?: string };
  api_app_id?: string;
  channel?: { id?: string };
  message?: { ts?: string; text?: string; user?: string; bot_id?: string };
  actions?: { action_id?: string; value?: string }[];
}
