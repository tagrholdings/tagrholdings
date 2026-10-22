import type { GeminiTool } from "@/lib/gemini";
import { ISSUE_HORIZONS, ISSUE_TYPES } from "@/modules/traction/traction.types";
import type { AgentData } from "./slack.agent";
import { addDays, buildDue, str } from "./slack.logic";
import type { PendingPayload, ProposalLabels } from "./slack.types";
import { toZonedInputValues } from "@/utils/date";

/**
 * The Traction/EOS tools: look at what is open (issues, to-dos, the scorecard and rocks summary) and propose a new Issue
 * for the IDS list or a new L10 To-Do. Writes are proposals like everywhere else. Who may do this is the app's own rule:
 * any member (the Traction services have no owner-only checks). The scorecard and rocks are read-only from Slack.
 */
type Args = Record<string, unknown>;
export type EosToolResult = { propose: PendingPayload } | { error: string } | { response: Record<string, unknown> };

const S = (description: string) => ({ type: "STRING", description });
const ID = (what: string) => S(`${what}'s id, exactly as returned by a search tool. Never invent one.`);

/** An L10 To-Do is a seven-day commitment: due a week from today unless the person said otherwise. */
export const TODO_DEFAULT_DAYS = 7;
const OPEN_LIST_LIMIT = 15;

export const EOS_TOOLS: GeminiTool[] = [
  {
    name: "list_traction",
    description: "What is open in the company's EOS: the issues waiting for the IDS list, the open L10 To-Dos (who, due when), and the summary of the scorecard (on/off goal) and of the quarter's Rocks. Read-only.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "add_issue",
    description: "Propose a new ISSUE for the IDS list (a problem, idea or obstacle to discuss in the L10). Nothing is saved until the person confirms.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: S("The issue in a short sentence, in the language the person used."),
        notes: S("Extra detail or context. Omit if none."),
        issue_type: { type: "STRING", enum: [...ISSUE_TYPES], description: "problem (default), idea or obstacle." },
        horizon: { type: "STRING", enum: [...ISSUE_HORIZONS], description: "short_term (default: for this week's L10) or long_term." },
        owner_person_id: ID("The team member who owns it"),
      },
      required: ["title"],
    },
  },
  {
    name: "add_todo",
    description: "Propose a new L10 TO-DO: a commitment for one person, due in seven days unless a date was said. Nothing is saved until the person confirms.",
    parameters: {
      type: "OBJECT",
      properties: {
        subject: S("What has to be done, in the language the person used."),
        assigned_to_person_id: ID("The team member who owns it (the sender when they said 'me' or named nobody)"),
        due_date: S("Due date as YYYY-MM-DD. Omit for the default of one week from today."),
      },
      required: ["subject"],
    },
  },
];

const NAMES = new Set(EOS_TOOLS.map((t) => t.name));
export const isEosTool = (name: string) => NAMES.has(name);

export async function runEosTool(name: string, args: Args, data: AgentData, ctx: { now: Date; timeZone: string; senderPersonId: string | null }): Promise<EosToolResult | undefined> {
  switch (name) {
    case "list_traction": {
      const [issues, todos, people, summary] = await Promise.all([data.issues(), data.todos(), data.people(), data.tractionSummary()]);
      const nameOf = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? null) : null);
      const today = toZonedInputValues(ctx.now, ctx.timeZone).date;
      const openIssues = issues.filter((i) => i.status === "open");
      const openTodos = todos.filter((t) => !t.done);
      return {
        response: {
          issues: { total: openIssues.length, items: openIssues.slice(0, OPEN_LIST_LIMIT).map((i) => ({ id: i.id, title: i.title, type: i.issueType, horizon: i.horizon, owner: nameOf(i.ownerPersonId) })) },
          todos: {
            total: openTodos.length,
            items: openTodos.slice(0, OPEN_LIST_LIMIT).map((t) => {
              const due = t.dueDate ? toZonedInputValues(t.dueDate, ctx.timeZone).date : null;
              return { id: t.id, subject: t.subject, assignee: nameOf(t.assignedToPersonId), due, overdue: !!due && due < today };
            }),
          },
          summary,
        },
      };
    }

    case "add_issue": {
      const title = str(args.title);
      if (!title) return { error: "title is required." };
      const issueType = (str(args.issue_type) ?? "problem") as (typeof ISSUE_TYPES)[number];
      const horizon = (str(args.horizon) ?? "short_term") as (typeof ISSUE_HORIZONS)[number];
      if (!ISSUE_TYPES.includes(issueType) || !ISSUE_HORIZONS.includes(horizon)) return { error: `issue_type must be one of ${ISSUE_TYPES.join(", ")} and horizon one of ${ISSUE_HORIZONS.join(", ")}.` };
      const labels: ProposalLabels = {};
      const ownerId = str(args.owner_person_id);
      if (ownerId) {
        const owner = (await data.people()).find((p) => p.id === ownerId);
        if (!owner) return { error: "owner_person_id is not on this workspace's team. Use search_people." };
        labels.assignee = owner.name ?? owner.email;
      }
      const notes = str(args.notes);
      if (notes && notes.length > 5000) return { error: "notes are too long (5000 characters at most)." };
      if (title.length > 200) return { error: "title is too long (200 characters at most) — shorten it and put the detail in notes." };
      return { propose: { kind: "add_issue", fields: { title, notes: notes ?? null, issueType, horizon, ownerPersonId: ownerId ?? null }, labels } };
    }

    case "add_todo": {
      const subject = str(args.subject);
      if (!subject) return { error: "subject is required." };
      if (subject.length > 200) return { error: "subject is too long (200 characters at most)." };
      const assigneeId = str(args.assigned_to_person_id) ?? ctx.senderPersonId;
      if (!assigneeId) return { error: "I don't know who this To-Do is for. Ask the person who should own it." };
      const assignee = (await data.people()).find((p) => p.id === assigneeId);
      if (!assignee) return { error: "assigned_to_person_id is not on this workspace's team. Use search_people." };
      const date = str(args.due_date) ?? addDays(toZonedInputValues(ctx.now, ctx.timeZone).date, TODO_DEFAULT_DAYS);
      const due = buildDue(date, undefined, ctx.timeZone);
      if (!due) return { error: "due_date must be YYYY-MM-DD." };
      return { propose: { kind: "add_todo", fields: { subject, assignedToPersonId: assigneeId, dueDate: due.dueDate }, labels: { assignee: assignee.name ?? assignee.email } } };
    }

    default:
      return undefined;
  }
}
