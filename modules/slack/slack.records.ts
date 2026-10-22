import type { GeminiTool } from "@/lib/gemini";
import type { AgentData } from "./slack.agent";
import { ACTIVITY_TYPES } from "@/modules/activities/activities.types";
import { normalizeText, resolveStage, searchByText, str } from "./slack.logic";
import { summarizePipeline } from "./slack.reports";
import { cardFieldsSchema, contactFieldsSchema, organizationFieldsSchema, type CardFields, type ContactFields, type OrganizationFields, type PendingPayload, type ProposalLabels } from "./slack.types";

/**
 * The tools for contacts, companies and the cards of the Leads and project boards: list/search, and propose a create or an
 * edit. Like the activity tools, none of them writes — a proposal goes back to the person as a card. Kept apart from
 * slack.agent.ts, which owns the loop and the activity tools.
 */
type Args = Record<string, unknown>;

export type RecordToolResult = { propose: PendingPayload } | { error: string } | { response: Record<string, unknown> };

const S = (description: string) => ({ type: "STRING", description });
const ID = (what: string) => S(`${what}'s id, exactly as returned by a search tool. Never invent one.`);
const DUPLICATE = { type: "BOOLEAN", description: "Only true when the person confirmed they want ANOTHER one with the same name, after you told them one already exists." };
const CLEAR = (fields: string[]) => ({ type: "ARRAY", items: { type: "STRING", enum: fields }, description: "Fields to empty, when the person asked to remove them." });

const CONTACT_PROPERTIES = {
  name: S("The person's full name, as they said it (fix obvious capitalisation)."),
  email: S("Email address. Omit if none was given."),
  phone: S("Phone number as given. Omit if none was given."),
  organization_id: ID("The company the contact works for"),
};

const ORGANIZATION_PROPERTIES = {
  name: S("The company's name."),
  website: S("Website. Omit if none was given."),
  notes: S("Anything worth keeping about the company."),
};

const CARD_PROPERTIES = {
  title: S("Title of the lead or project card, in the language the person used."),
  stage: S("The stage the card is in, by its name or id (see list_boards). Omit on create to start in the first stage."),
  contact_id: ID("The contact the card is about"),
  organization_id: ID("The company the card is about"),
  notes: S("Notes on the card. Omit if none were given."),
};

export const RECORD_TOOLS: GeminiTool[] = [
  {
    name: "weekly_report",
    description: "The weekly report's numbers: pipeline per stage, new and stuck cards, tasks, how this week's leads were handled, engine spend, and the EOS overview. Read-only. Use it for 'send me the weekly report', 'how did the week go?'. Present it as a short report.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "pipeline_summary",
    description: "How the pipeline is doing: cards per stage on every board, cards created in the last 7 days, STALE cards (untouched 14+ days, not in the last stage), tasks overdue / due today / done this week, and new leads waiting for review. Read-only. Use it for 'how is the pipeline?', 'what is stuck?'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "add_note",
    description: "Propose adding a dated conversation note to a card (lead or project), a company or a contact — appended after what is there, never replacing it. Use it for 'log that I talked to X', 'note on the Padaria lead: …'. Nothing is saved until the person confirms.",
    parameters: {
      type: "OBJECT",
      properties: {
        target: { type: "STRING", enum: ["card", "company", "contact"], description: "Where the note goes." },
        id: ID("The card, company or contact"),
        text: S("The note, in the language the person used. Keep their meaning and the facts (names, numbers, next step). Do NOT put the date or the author in it — both are added automatically."),
        activity_type: { type: "STRING", enum: [...ACTIVITY_TYPES], description: "Only for a contact: what the conversation was (call, meeting, email). Default call." },
      },
      required: ["target", "id", "text"],
    },
  },
  {
    name: "list_boards",
    description: "The boards and their stages: the Leads board (kind 'leads') and the project boards (kind 'project'). Use it to answer 'what projects do we have' and to pick the board and stage of a card.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "search_pipeline_items",
    description: "Find or LIST the cards on the boards — leads and project cards — by title, or by their contact/company. With no query it lists them. Filter by board and stage. Use it to answer 'list my leads', 'what is in discussion', 'show the projects'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: S("Part of the card's title, or its contact/company name. Omit to list."),
        board_id: ID("Only this board"),
        stage: S("Only this stage, by name or id."),
        kind: { type: "STRING", enum: ["leads", "project", "any"], description: "leads = the Leads board only, project = project boards only. Default any." },
      },
    },
  },
  {
    name: "create_contact",
    description: "Propose a NEW contact (a person outside the team). Search first: if one with that name exists, tell the person instead of creating. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: { ...CONTACT_PROPERTIES, allow_duplicate: DUPLICATE }, required: ["name"] },
  },
  {
    name: "update_contact",
    description: "Propose a change to an EXISTING contact (found with search_contacts). Send only what changes. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: { contact_id: ID("The contact"), ...CONTACT_PROPERTIES, clear: CLEAR(["email", "phone", "organization"]) }, required: ["contact_id"] },
  },
  {
    name: "create_organization",
    description: "Propose a NEW company. Search first: if one with that name exists, tell the person instead. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: ORGANIZATION_PROPERTIES, required: ["name"] },
  },
  {
    name: "update_organization",
    description: "Propose a change to an EXISTING company (found with search_organizations). Send only what changes. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: { organization_id: ID("The company"), ...ORGANIZATION_PROPERTIES, clear: CLEAR(["website", "notes"]) }, required: ["organization_id"] },
  },
  {
    name: "create_pipeline_item",
    description: "Propose a NEW card: a lead (on the Leads board) or an item of a project board. Pick the board with list_boards. Search first so you don't duplicate one. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: { board_id: ID("The board"), ...CARD_PROPERTIES, allow_duplicate: DUPLICATE }, required: ["board_id", "title"] },
  },
  {
    name: "update_pipeline_item",
    description: "Propose a change to an EXISTING card (found with search_pipeline_items): its title, notes, contact, company, or its STAGE (moving it forward). Send only what changes. Nothing is saved until the person confirms.",
    parameters: { type: "OBJECT", properties: { item_id: ID("The card"), ...CARD_PROPERTIES, clear: CLEAR(["notes", "contact", "organization"]) }, required: ["item_id"] },
  },
];

const RECORD_TOOL_NAMES = new Set(RECORD_TOOLS.map((t) => t.name));
export const isRecordTool = (name: string) => RECORD_TOOL_NAMES.has(name);

const LIST_LIMIT = 20;

const firstIssue = (error: { issues: { path: PropertyKey[]; message: string }[] }) => error.issues.map((i) => (i.path.length ? `${i.path.map(String).join(".")}: ` : "") + i.message).join("; ");

/** "acme.com" → "https://acme.com": people say a website the way they'd type it in a browser. */
function withScheme(website: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(website) ? website : `https://${website}`;
}

const sameName = (a: string, b: string) => normalizeText(a) === normalizeText(b);

export async function runRecordTool(name: string, args: Args, data: AgentData, ctx: { now: Date; timeZone: string }): Promise<RecordToolResult | undefined> {
  switch (name) {
    case "weekly_report":
      return { response: { ...(await data.weeklyReport(ctx)) } };

    case "pipeline_summary": {
      const [items, boards, activities, newLeads] = await Promise.all([data.pipelineItems(), data.boards(), data.activities(), data.newLeads()]);
      return { response: { ...summarizePipeline({ items, boards, activities, newLeads, now: ctx.now, timeZone: ctx.timeZone }) } };
    }

    case "add_note": {
      const target = str(args.target);
      const id = str(args.id);
      const text = str(args.text);
      if (!text) return { error: "text is required." };
      if (text.length > 2000) return { error: "That note is too long (2000 characters at most). Shorten it to the facts." };
      let label: string | undefined;
      if (target === "card") label = (await data.pipelineItems()).find((i) => i.id === id)?.title;
      else if (target === "company") label = (await data.organizations()).find((o) => o.id === id)?.name;
      else if (target === "contact") label = (await data.contacts()).find((c) => c.id === id)?.name;
      else return { error: "target must be card, company or contact." };
      if (!label || !id) return { error: `No ${target} with that id in this workspace. Search for it first.` };
      const activityType = (str(args.activity_type) ?? "call") as (typeof ACTIVITY_TYPES)[number];
      if (!ACTIVITY_TYPES.includes(activityType)) return { error: `activity_type must be one of ${ACTIVITY_TYPES.join(", ")}.` };
      return { propose: { kind: "add_note", target, id, label, text, activityType } };
    }

    case "list_boards": {
      const boards = (await data.boards()).filter((b) => !b.archivedAt);
      return { response: { boards: boards.map((b) => ({ id: b.id, name: b.name, kind: b.isSystem ? "leads" : "project", stages: b.columns })) } };
    }

    case "search_pipeline_items": {
      const [items, boards] = await Promise.all([data.pipelineItems(), data.boards()]);
      const boardId = str(args.board_id);
      const kind = str(args.kind) ?? "any";
      let rows = items.filter((i) => (!boardId || i.boardId === boardId) && (kind === "any" || (kind === "leads") === i.boardIsSystem));
      const stage = str(args.stage);
      if (stage) {
        // The stage is looked up in each item's own board, so "in discussion" finds it wherever a board has such a stage.
        rows = rows.filter((i) => {
          const found = resolveStage(boards.find((b) => b.id === i.boardId)?.columns ?? [], stage);
          return found?.id === i.stage;
        });
      }
      const query = str(args.query);
      const ranked = query ? searchByText(rows, query, (i) => [i.title, i.contactName, i.organizationName], rows.length).map((m) => m.item) : rows;
      const shown = ranked.slice(0, LIST_LIMIT);
      return {
        response: {
          total: ranked.length,
          shown: shown.length,
          results: shown.map((i) => ({
            id: i.id,
            title: i.title,
            kind: i.boardIsSystem ? "lead" : "project",
            board: i.boardName,
            board_id: i.boardId,
            stage: boards.find((b) => b.id === i.boardId)?.columns.find((c) => c.id === i.stage)?.label ?? i.stage,
            contact: i.contactName,
            company: i.organizationName,
            notes: i.notes ? (i.notes.length > 200 ? `${i.notes.slice(0, 200)}…` : i.notes) : null,
          })),
        },
      };
    }

    case "create_contact":
    case "update_contact": {
      const contacts = await data.contacts();
      const creating = name === "create_contact";
      const current = creating ? null : contacts.find((c) => c.id === str(args.contact_id));
      if (!creating && !current) return { error: "No contact with that id. Use search_contacts." };

      const clears = new Set(Array.isArray(args.clear) ? (args.clear as unknown[]).map(String) : []);
      const email = str(args.email);
      const phone = str(args.phone);
      const org = str(args.organization_id);
      const candidate = {
        name: str(args.name) ?? current?.name ?? "",
        email: clears.has("email") ? null : (email ?? current?.email ?? null),
        phone: clears.has("phone") ? null : (phone ?? current?.phone ?? null),
        organizationId: clears.has("organization") ? null : (org ?? current?.organizationId ?? null),
      };
      const parsed = contactFieldsSchema.safeParse(candidate);
      if (!parsed.success) return { error: firstIssue(parsed.error) };
      const fields: ContactFields = parsed.data;

      const labels: ProposalLabels = {};
      if (fields.organizationId) {
        const organization = (await data.organizations()).find((o) => o.id === fields.organizationId);
        if (!organization) return { error: "organization_id is not in this workspace. Use search_organizations." };
        labels.organization = organization.name;
      }
      if (creating && args.allow_duplicate !== true) {
        const twin = contacts.find((c) => sameName(c.name, fields.name));
        if (twin) return { error: `A contact named "${twin.name}" already exists (id ${twin.id}${twin.organizationName ? `, at ${twin.organizationName}` : ""}). Tell the person and ask whether they mean that one; only if they want another, call again with allow_duplicate true.` };
      }
      return { propose: creating ? { kind: "create_contact", fields, labels } : { kind: "update_contact", id: current!.id, fields, labels, was: current!.name } };
    }

    case "create_organization":
    case "update_organization": {
      const organizations = await data.organizations();
      const creating = name === "create_organization";
      const current = creating ? null : organizations.find((o) => o.id === str(args.organization_id));
      if (!creating && !current) return { error: "No company with that id. Use search_organizations." };

      const clears = new Set(Array.isArray(args.clear) ? (args.clear as unknown[]).map(String) : []);
      const website = str(args.website);
      const notes = str(args.notes);
      const parsed = organizationFieldsSchema.safeParse({
        name: str(args.name) ?? current?.name ?? "",
        website: clears.has("website") ? null : website ? withScheme(website) : (current?.website || null),
        notes: clears.has("notes") ? null : (notes ?? current?.notes ?? null),
      });
      if (!parsed.success) return { error: firstIssue(parsed.error) };
      const fields: OrganizationFields = parsed.data;

      const twin = organizations.find((o) => sameName(o.name, fields.name) && o.id !== current?.id);
      if (twin) return { error: `A company named "${twin.name}" already exists (id ${twin.id}). Use it, or tell the person.` };
      return { propose: creating ? { kind: "create_organization", fields } : { kind: "update_organization", id: current!.id, fields, was: current!.name } };
    }

    case "create_pipeline_item":
    case "update_pipeline_item": {
      const [items, boards] = await Promise.all([data.pipelineItems(), data.boards()]);
      const creating = name === "create_pipeline_item";
      const current = creating ? null : items.find((i) => i.id === str(args.item_id));
      if (!creating && !current) return { error: "No card with that id. Use search_pipeline_items." };
      const board = boards.find((b) => b.id === (current ? current.boardId : str(args.board_id)));
      if (!board || (creating && board.archivedAt)) return { error: "No such board. Use list_boards." };

      const stageInput = str(args.stage);
      const stage = stageInput ? resolveStage(board.columns, stageInput) : null;
      if (stageInput && !stage) return { error: `"${stageInput}" is not a stage of ${board.name}. Its stages: ${board.columns.map((c) => `${c.label} (${c.id})`).join(", ")}.` };

      const clears = new Set(Array.isArray(args.clear) ? (args.clear as unknown[]).map(String) : []);
      const contact = str(args.contact_id);
      const org = str(args.organization_id);
      const notes = str(args.notes);
      const parsed = cardFieldsSchema.safeParse({
        boardId: board.id,
        title: str(args.title) ?? current?.title ?? "",
        stage: stage?.id ?? current?.stage ?? board.columns[0]?.id,
        contactId: clears.has("contact") ? null : (contact ?? current?.contactId ?? null),
        organizationId: clears.has("organization") ? null : (org ?? current?.organizationId ?? null),
        notes: clears.has("notes") ? null : (notes ?? current?.notes ?? null),
      });
      if (!parsed.success) return { error: firstIssue(parsed.error) };
      const fields: CardFields = parsed.data;

      const labels: ProposalLabels = { board: board.name, stage: board.columns.find((c) => c.id === fields.stage)?.label ?? fields.stage, isLead: board.isSystem };
      if (fields.contactId) {
        const found = (await data.contacts()).find((c) => c.id === fields.contactId);
        if (!found) return { error: "contact_id is not in this workspace. Use search_contacts." };
        labels.contact = found.name;
      }
      if (fields.organizationId) {
        const found = (await data.organizations()).find((o) => o.id === fields.organizationId);
        if (!found) return { error: "organization_id is not in this workspace. Use search_organizations." };
        labels.organization = found.name;
      }
      if (creating && args.allow_duplicate !== true) {
        const twin = items.find((i) => i.boardId === board.id && sameName(i.title, fields.title));
        if (twin) return { error: `A card titled "${twin.title}" already exists on ${board.name} (id ${twin.id}). Tell the person; only if they want another, call again with allow_duplicate true.` };
      }
      return { propose: creating ? { kind: "create_card", fields, labels } : { kind: "update_card", id: current!.id, fields, labels, was: current!.title } };
    }

    default:
      return undefined;
  }
}
