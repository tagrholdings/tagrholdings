import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_TYPE_LABELS } from "@/modules/activities/activities.types";
import type { PendingPayload, ProposalFields, ProposalLabels } from "./slack.types";

export const CONFIRM_ACTION_ID = "slack_confirm";
export const CANCEL_ACTION_ID = "slack_cancel";

/** Slack's mrkdwn reads &, < and > as markup: user text must not be able to make a link or a mention. */
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "Fri, Oct 23 · 2:00 PM" (or just the date when no time was set) as the person who asked reads it. */
export function formatDue(dueDate: string, timezone: string | null | undefined, personTimeZone: string): string {
  const date = new Date(dueDate);
  if (!timezone) {
    return new Intl.DateTimeFormat("en-US", { timeZone: personTimeZone, weekday: "short", month: "short", day: "numeric" }).format(date);
  }
  const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", ...(timezone !== personTimeZone ? { timeZoneName: "short" as const } : {}) }).format(date);
  return `${day} · ${time}`;
}

function fieldLines(fields: ProposalFields, labels: ProposalLabels, personTimeZone: string): string[] {
  const line = (label: string, value: string | null | undefined) => (value ? `*${label}*\n${escapeMrkdwn(value)}` : null);
  return [
    line("Due", fields.dueDate ? formatDue(fields.dueDate, fields.timezone, personTimeZone) : null),
    line("Assigned to", labels.assignee),
    line("Lead / project", labels.pipelineItem),
    line("Contact", labels.contact),
    line("Company", labels.organization),
    line("Priority", fields.priority ? ACTIVITY_PRIORITY_LABELS[fields.priority] : null),
    line("Reminder", fields.notify ? "Push notification at the due time" : null),
  ].filter((l): l is string => !!l);
}

/** The confirmation card: everything the bot understood, and two buttons. The buttons carry only the pending id. */
export function proposalBlocks(payload: PendingPayload, pendingId: string, personTimeZone: string): { text: string; blocks: unknown[] } {
  let heading: string;
  let fields: string[] = [];
  let notes: string | null | undefined;

  if (payload.kind === "complete") {
    heading = `${payload.done ? "Mark as done" : "Reopen"}: *${escapeMrkdwn(payload.subject)}*`;
  } else {
    const type = ACTIVITY_TYPE_LABELS[payload.fields.type];
    heading = payload.kind === "create" ? `New ${type.toLowerCase()}: *${escapeMrkdwn(payload.fields.subject)}*` : `Update ${type.toLowerCase()}: *${escapeMrkdwn(payload.fields.subject)}*`;
    fields = fieldLines(payload.fields, payload.labels, personTimeZone);
    notes = payload.fields.notes;
  }

  const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: heading } }];
  // Slack allows at most 10 fields per section.
  if (fields.length > 0) blocks.push({ type: "section", fields: fields.slice(0, 10).map((text) => ({ type: "mrkdwn", text })) });
  if (notes) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Notes*\n${escapeMrkdwn(notes.length > 600 ? `${notes.slice(0, 600)}…` : notes)}` } });
  blocks.push({
    type: "actions",
    elements: [
      { type: "button", style: "primary", action_id: CONFIRM_ACTION_ID, value: pendingId, text: { type: "plain_text", text: payload.kind === "create" ? "Create" : payload.kind === "update" ? "Save changes" : "Confirm" } },
      { type: "button", action_id: CANCEL_ACTION_ID, value: pendingId, text: { type: "plain_text", text: "Cancel" } },
    ],
  });
  return { text: heading.replace(/\*/g, ""), blocks };
}

/** What replaces the card once it was used (the buttons go away so it can't be pressed twice). */
export function resolvedBlocks(text: string): { text: string; blocks: unknown[] } {
  return { text: text.replace(/\*/g, ""), blocks: [{ type: "section", text: { type: "mrkdwn", text } }] };
}
