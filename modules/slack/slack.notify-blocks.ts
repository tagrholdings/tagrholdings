import { formatUsd } from "@/utils/money";
import { escapeMrkdwn } from "./slack.blocks";
import type { PipelineSummary } from "./slack.reports";

/**
 * The messages the bot sends on its own (reminders, new-lead cards, digests, the weekly report). Buttons carry
 * "<workspace id>.<thing id>" like the confirmation cards do, so a press says which workspace it is for.
 */
export const DONE_ACTION_ID = "slack_done";
export const SNOOZE_ACTION_ID = "slack_snooze";
export const LEAD_PROMOTE_ACTION_ID = "slack_lead_promote";
export const LEAD_DISMISS_ACTION_ID = "slack_lead_dismiss";
/** A link button still reports a press to Slack; it is acknowledged and ignored. */
export const OPEN_ACTION_ID = "slack_open";

export interface Message {
  text: string;
  blocks: unknown[];
}

const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
const linkButton = (label: string, url: string) => ({ type: "button", action_id: OPEN_ACTION_ID, url, text: { type: "plain_text", text: label } });
const button = (label: string, actionId: string, value: string, style?: "primary" | "danger") => ({
  type: "button",
  action_id: actionId,
  value,
  ...(style ? { style } : {}),
  text: { type: "plain_text", text: label },
});

/** "⏰ Call João is due now" with Done / Snooze / Open. */
export function reminderMessage(input: { subject: string; typeLabel: string; value: string; url: string }): Message {
  const text = `⏰ ${input.typeLabel}: ${input.subject} is due now`;
  return {
    text,
    blocks: [
      section(`⏰ *${escapeMrkdwn(input.subject)}* is due now _(${escapeMrkdwn(input.typeLabel.toLowerCase())})_`),
      { type: "actions", elements: [button("Done", DONE_ACTION_ID, input.value, "primary"), button("Snooze 1 day", SNOOZE_ACTION_ID, input.value), linkButton("Open", input.url)] },
    ],
  };
}

/** "📌 New task for you" — from whoever assigned it. */
export function assignedMessage(input: { subject: string; typeLabel: string; due: string | null; from: string | null; value: string; url: string }): Message {
  const details = [input.due ? `due ${input.due}` : null, input.from ? `from ${input.from}` : null].filter(Boolean).join(" · ");
  return {
    text: `📌 New ${input.typeLabel.toLowerCase()} for you: ${input.subject}`,
    blocks: [
      section(`📌 New ${escapeMrkdwn(input.typeLabel.toLowerCase())} for you: *${escapeMrkdwn(input.subject)}*${details ? `\n${escapeMrkdwn(details)}` : ""}`),
      { type: "actions", elements: [button("Done", DONE_ACTION_ID, input.value, "primary"), linkButton("Open", input.url)] },
    ],
  };
}

const FIT_BADGE: Record<string, string> = { match: "✅ Good fit", partial: "🟡 Partial fit", miss: "❌ Poor fit", unknown: "⚪ Fit unknown" };

export interface LeadCardInput {
  businessName: string;
  source: string;
  fit: string | null;
  askingPrice: string | null;
  revenue: string | null;
  place: string | null;
  summary: string | null;
  sourceUrl: string | null;
  value: string;
}

/** A new engine/e-mail/manual lead, ready to be added to the pipeline or dismissed from Slack. */
export function leadMessage(input: LeadCardInput): Message {
  const facts = [input.askingPrice ? `*Asking:* ${escapeMrkdwn(input.askingPrice)}` : null, input.revenue ? `*Revenue:* ${escapeMrkdwn(input.revenue)}` : null, input.place ? `*Where:* ${escapeMrkdwn(input.place)}` : null].filter(Boolean);
  const head = `🆕 *${escapeMrkdwn(input.businessName)}*${input.fit ? ` · ${FIT_BADGE[input.fit] ?? ""}` : ""} _(${escapeMrkdwn(input.source)})_`;
  const summary = input.summary ? escapeMrkdwn(input.summary.length > 220 ? `${input.summary.slice(0, 220)}…` : input.summary) : null;
  const safeUrl = input.sourceUrl && /^https?:\/\//i.test(input.sourceUrl) ? input.sourceUrl : null;
  return {
    text: `New lead: ${input.businessName}`,
    blocks: [
      section([head, facts.join("  ·  "), summary].filter(Boolean).join("\n")),
      {
        type: "actions",
        elements: [button("Add to pipeline", LEAD_PROMOTE_ACTION_ID, input.value, "primary"), button("Dismiss", LEAD_DISMISS_ACTION_ID, input.value), ...(safeUrl ? [linkButton("View listing", safeUrl)] : [])],
      },
    ],
  };
}

/** The line that follows the cards when more leads arrived than are shown. */
export function moreLeadsMessage(count: number, url: string): Message {
  const text = `…and ${count} more new lead${count === 1 ? "" : "s"} to review.`;
  return { text, blocks: [section(text), { type: "actions", elements: [linkButton("Review in the CRM", url)] }] };
}

export interface DigestItem {
  subject: string;
  /** "2:00 PM" when the task has a time; null for a date-only task. */
  time: string | null;
}

/** The morning summary: what is due today and what is already overdue, for one person. */
export function digestMessage(input: { today: DigestItem[]; overdue: DigestItem[]; url: string }): Message {
  const line = (item: DigestItem) => `• ${escapeMrkdwn(item.subject)}${item.time ? ` _(${escapeMrkdwn(item.time)})_` : ""}`;
  const block = (title: string, items: DigestItem[]) => (items.length ? `*${title}* (${items.length})\n${items.slice(0, 8).map(line).join("\n")}${items.length > 8 ? `\n_…and ${items.length - 8} more_` : ""}` : null);
  const parts = [`☀️ *Good morning* — ${input.today.length} due today, ${input.overdue.length} overdue`, block("Due today", input.today), block("Overdue", input.overdue)].filter((p): p is string => !!p);
  return { text: `Good morning — ${input.today.length} due today, ${input.overdue.length} overdue`, blocks: [section(parts.join("\n\n")), { type: "actions", elements: [linkButton("Open my tasks", input.url)] }] };
}

export interface WeeklyReport {
  workspaceName: string;
  /** "Oct 19 – Oct 26": the week the report covers, ending today. */
  period: string;
  pipeline: PipelineSummary;
  leads: { arrived: number; added: number; dismissed: number; waiting: number; engineCostUsd: number };
  traction: {
    scorecard: { onGoal: number; offGoal: number; notEntered: number; total: number };
    rocks: { quarter: string; total: number; complete: number; onTrack: number; offTrack: number };
    openIssues: number;
    todos: { done: number; total: number };
  } | null;
}

/** The weekly report for admins. Plain numbers from the database — no model in the loop — with its caveats stated at the bottom. */
export function weeklyReportMessage(report: WeeklyReport, urls: { pipeline: string; traction: string }): Message {
  const { pipeline, leads, traction } = report;
  const boards = pipeline.boards.map((b) => `• *${escapeMrkdwn(b.name)}* (${b.total}): ${b.stages.map((s) => `${escapeMrkdwn(s.label)} ${s.count}`).join(" · ")}`);
  const created = pipeline.createdLast7Days.count > 0 ? `New cards: *${pipeline.createdLast7Days.count}* — ${pipeline.createdLast7Days.titles.map(escapeMrkdwn).join(", ")}${pipeline.createdLast7Days.count > pipeline.createdLast7Days.titles.length ? ", …" : ""}` : "New cards: none";
  const stale = pipeline.staleTotal > 0 ? `Stuck (untouched 14+ days): *${pipeline.staleTotal}* — ${pipeline.stale.slice(0, 5).map((s) => `${escapeMrkdwn(s.title)} (${escapeMrkdwn(s.stage)}, ${s.daysIdle}d)`).join(", ")}${pipeline.staleTotal > 5 ? ", …" : ""}` : "Stuck cards: none";
  const sections = [
    `📊 *Weekly report* · ${escapeMrkdwn(report.workspaceName)} · ${escapeMrkdwn(report.period)}`,
    `*Pipeline*\n${boards.join("\n") || "_No boards yet._"}\n${created}\n${stale}`,
    `*Tasks*\n${pipeline.activities.overdue} overdue · ${pipeline.activities.dueToday} due today · ${pipeline.activities.doneLast7Days} done this week`,
    `*Leads*\n${leads.arrived} arrived this week (${leads.added} added to the pipeline, ${leads.dismissed} dismissed) · *${leads.waiting}* waiting for review${leads.engineCostUsd > 0 ? ` · engine spend last 7 days: ${formatUsd(leads.engineCostUsd)}` : ""}`,
    traction
      ? `*EOS*\nScorecard: ${traction.scorecard.onGoal} on goal · ${traction.scorecard.offGoal} off goal · ${traction.scorecard.notEntered} not entered\nRocks (${escapeMrkdwn(traction.rocks.quarter)}): ${traction.rocks.complete}/${traction.rocks.total} complete · ${traction.rocks.offTrack} off track\nOpen issues: ${traction.openIssues} · To-Dos: ${traction.todos.done}/${traction.todos.total} done`
      : null,
    "_Counts come straight from the CRM. It does not record stage changes or completion times, so “stuck” means untouched and “done this week” means last updated this week._",
  ].filter((s): s is string => !!s);
  return {
    text: `Weekly report · ${report.workspaceName} · ${report.period}`,
    blocks: [section(sections.slice(0, 5).join("\n\n")), section(sections.slice(5).join("\n\n")), { type: "actions", elements: [linkButton("Open the pipeline", urls.pipeline), linkButton("Open Traction", urls.traction)] }].filter((b) => !(b.type === "section" && !(b as { text: { text: string } }).text.text)),
  };
}

/** The L10 reminder: when, and the points the meeting will cover. */
export function l10Message(input: { workspaceName: string; when: string; url: string; topIssues: string[]; offGoal: string[]; offTrackRocks: string[]; openTodos: number }): Message {
  const list = (label: string, items: string[]) => (items.length ? `*${label}:* ${items.slice(0, 3).map(escapeMrkdwn).join(" · ")}${items.length > 3 ? ` (+${items.length - 3})` : ""}` : null);
  const lines = [
    `🗓 *L10 in about an hour* · ${escapeMrkdwn(input.workspaceName)}`,
    escapeMrkdwn(input.when),
    list("Top issues", input.topIssues),
    list("Off goal", input.offGoal),
    list("Rocks off track", input.offTrackRocks),
    input.openTodos > 0 ? `*Open to-dos:* ${input.openTodos}` : null,
  ].filter((l): l is string => !!l);
  return { text: `L10 in about an hour · ${input.workspaceName} · ${input.when}`, blocks: [section(lines.join("\n")), { type: "actions", elements: [linkButton("Open the agenda", input.url)] }] };
}
