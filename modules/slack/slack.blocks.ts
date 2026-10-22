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

const line = (label: string, value: string | null | undefined) => (value ? `*${label}*
${escapeMrkdwn(value)}` : null);
const present = (lines: (string | null)[]) => lines.filter((l): l is string => !!l);

function fieldLines(fields: ProposalFields, labels: ProposalLabels, personTimeZone: string): string[] {
  return present([
    line("Due", fields.dueDate ? formatDue(fields.dueDate, fields.timezone, personTimeZone) : null),
    line("Assigned to", labels.assignee),
    line("Lead / project", labels.pipelineItem),
    line("Contact", labels.contact),
    line("Company", labels.organization),
    line("Priority", fields.priority ? ACTIVITY_PRIORITY_LABELS[fields.priority] : null),
    line("Reminder", fields.notify ? "Push notification at the due time" : null),
  ]);
}

/** What one proposal says on its card: the headline, the fields, the notes, and what the confirm button is called. */
function describe(payload: PendingPayload, personTimeZone: string): { heading: string; fields: string[]; notes?: string | null; confirm: string } {
  const bold = (text: string) => `*${escapeMrkdwn(text)}*`;
  switch (payload.kind) {
    case "complete":
      return { heading: `${payload.done ? "Mark as done" : "Reopen"}: ${bold(payload.subject)}`, fields: [], confirm: "Confirm" };
    case "create":
    case "update": {
      const type = ACTIVITY_TYPE_LABELS[payload.fields.type].toLowerCase();
      return {
        heading: `${payload.kind === "create" ? "New" : "Update"} ${type}: ${bold(payload.fields.subject)}`,
        fields: fieldLines(payload.fields, payload.labels, personTimeZone),
        notes: payload.fields.notes,
        confirm: payload.kind === "create" ? "Create" : "Save changes",
      };
    }
    case "create_contact":
    case "update_contact":
      return {
        heading: `${payload.kind === "create_contact" ? "New contact" : "Update contact"}: ${bold(payload.fields.name)}`,
        fields: present([line("Email", payload.fields.email), line("Phone", payload.fields.phone), line("Company", payload.labels.organization)]),
        confirm: payload.kind === "create_contact" ? "Create" : "Save changes",
      };
    case "create_organization":
    case "update_organization":
      return {
        heading: `${payload.kind === "create_organization" ? "New company" : "Update company"}: ${bold(payload.fields.name)}`,
        fields: present([line("Website", payload.fields.website)]),
        notes: payload.fields.notes,
        confirm: payload.kind === "create_organization" ? "Create" : "Save changes",
      };
    case "create_card":
    case "update_card": {
      const what = payload.labels.isLead ? "lead" : "project card";
      return {
        heading: `${payload.kind === "create_card" ? "New" : "Update"} ${what}: ${bold(payload.fields.title)}`,
        fields: present([line("Board", payload.labels.board), line("Stage", payload.labels.stage), line("Contact", payload.labels.contact), line("Company", payload.labels.organization)]),
        notes: payload.fields.notes,
        confirm: payload.kind === "create_card" ? "Create" : "Save changes",
      };
    }
  }
}

/** The confirmation card: everything the bot understood, and two buttons. The buttons carry only `value` (which stored proposal). */
export function proposalBlocks(payload: PendingPayload, value: string, personTimeZone: string): { text: string; blocks: unknown[] } {
  const { heading, fields, notes, confirm } = describe(payload, personTimeZone);
  const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: heading } }];
  // Slack allows at most 10 fields per section.
  if (fields.length > 0) blocks.push({ type: "section", fields: fields.slice(0, 10).map((text) => ({ type: "mrkdwn", text })) });
  if (notes) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Notes*
${escapeMrkdwn(notes.length > 600 ? `${notes.slice(0, 600)}…` : notes)}` } });
  blocks.push({
    type: "actions",
    elements: [
      { type: "button", style: "primary", action_id: CONFIRM_ACTION_ID, value, text: { type: "plain_text", text: confirm } },
      { type: "button", action_id: CANCEL_ACTION_ID, value, text: { type: "plain_text", text: "Cancel" } },
    ],
  });
  return { text: heading.replace(/\*/g, ""), blocks };
}

/** What replaces the card once it was used (the buttons go away so it can't be pressed twice). */
export function resolvedBlocks(text: string): { text: string; blocks: unknown[] } {
  return { text: text.replace(/\*/g, ""), blocks: [{ type: "section", text: { type: "mrkdwn", text } }] };
}
