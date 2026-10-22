import { describe, expect, it, vi } from "vitest";
import type { GeminiTurn } from "@/lib/gemini";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { runAgent, type AgentData } from "./slack.agent";

vi.mock("@/lib/gemini", () => ({ generateGemini: vi.fn(), GeminiUnavailable: class extends Error {} }));

const MARIA = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const ACTIVITY = "33333333-3333-4333-8333-333333333333";
const JOAO = "44444444-4444-4444-8444-444444444444";
const PADARIA = "55555555-5555-4555-8555-555555555555";
const LEADS_BOARD = "66666666-6666-4666-8666-666666666666";
const PROJECTS_BOARD = "77777777-7777-4777-8777-777777777777";
const CARD = "88888888-8888-4888-8888-888888888888";

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: ACTIVITY,
  type: "call",
  subject: "Call João",
  dueDate: new Date("2026-10-23T21:00:00.000Z"),
  timezone: "America/Phoenix",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  done: false,
  priority: null,
  notes: null,
  contactId: null,
  contactName: null,
  organizationId: null,
  organizationName: null,
  pipelineItemId: null,
  pipelineItemTitle: null,
  rockId: null,
  rockTitle: null,
  assignedToPersonId: null,
  assignedToContactId: null,
  assignedToContactName: null,
  notify: false,
  l10Todo: false,
  ...over,
});

const data = (activities: ActivityRow[] = []): AgentData => ({
  people: async () => [{ id: MARIA, name: "Maria Silva", email: "maria@tagr.com" }],
  pipelineItems: async () => [
    { id: LEAD, boardId: LEADS_BOARD, title: "Padaria X", stage: "sourced", notes: null, boardName: "Leads", boardIsSystem: true, contactId: null, contactName: null, organizationId: null, organizationName: null, createdAt: new Date("2026-10-20T12:00:00Z"), updatedAt: new Date("2026-10-21T12:00:00Z") },
    { id: CARD, boardId: PROJECTS_BOARD, title: "Due diligence checklist", stage: "todo", notes: "start with the leases", boardName: "Diligence", boardIsSystem: false, contactId: JOAO, contactName: "João Pereira", organizationId: PADARIA, organizationName: "Padaria X", createdAt: new Date("2026-08-01T12:00:00Z"), updatedAt: new Date("2026-09-01T12:00:00Z") },
  ],
  boards: async () => [
    { id: LEADS_BOARD, name: "Leads", isSystem: true, archivedAt: null, columns: [{ id: "sourced", label: "Sourced" }, { id: "in_discussion", label: "In Discussion" }, { id: "closed", label: "Closed" }] },
    { id: PROJECTS_BOARD, name: "Diligence", isSystem: false, archivedAt: null, columns: [{ id: "todo", label: "To do" }, { id: "doing", label: "In progress" }, { id: "done", label: "Done" }] },
  ],
  contacts: async () => [{ id: JOAO, name: "João Pereira", email: "joao@padaria.com", phone: "602-555-0100", organizationId: PADARIA, organizationName: "Padaria X" }],
  organizations: async () => [{ id: PADARIA, name: "Padaria X", website: "https://padaria.com", notes: null }],
  activities: async () => activities,
  newLeads: async () => 4,
  issues: async () => [
    { id: "i1", title: "Hiring is behind", status: "open", issueType: "problem", horizon: "short_term", ownerPersonId: MARIA },
    { id: "i2", title: "Old one", status: "solved", issueType: "idea", horizon: "long_term", ownerPersonId: null },
  ],
  todos: async () => [
    { id: "t1", subject: "Send the LOI", done: false, dueDate: new Date("2026-10-21T07:00:00Z"), assignedToPersonId: MARIA },
    { id: "t2", subject: "Done thing", done: true, dueDate: null, assignedToPersonId: null },
  ],
  tractionSummary: async () => ({ scorecard: { onGoal: 3, offGoal: 1, notEntered: 0, total: 4 } }),
  weeklyReport: async ({ timeZone }) => ({ period: "Oct 15 – Oct 22", timeZone }),
});

/** Runs one scripted tool call and returns what the agent decided. */
async function callTool(name: string, args: Record<string, unknown>) {
  const { generate, seen } = script([{ name, args }], [{ name: "ignore", args: {} }]);
  const outcome = await runAgent(input, deps(generate));
  return { outcome, seen };
}
const lastResponse = (seen: unknown[]) => JSON.parse(JSON.stringify(seen[1])).at(-1).parts[0].functionResponse.response;

/** A model that plays a fixed script: one turn per entry, each a list of tool calls. */
function script(...turns: { name: string; args: Record<string, unknown> }[][]) {
  let i = 0;
  const seen: unknown[] = [];
  const generate = vi.fn(async ({ contents }: { contents: unknown[] }): Promise<GeminiTurn> => {
    seen.push(structuredClone(contents));
    const calls = turns[i++] ?? [{ name: "ignore", args: {} }];
    return { content: { role: "model", parts: calls.map((c) => ({ functionCall: c })) }, calls, text: "", inputTokens: 0, outputTokens: 0 };
  });
  return { generate, seen };
}

const input = { text: "x", timeZone: "America/Phoenix", now: new Date("2026-10-22T19:00:00Z") };
const deps = (generate: ReturnType<typeof script>["generate"], d = data()) => ({ generate, data: d, userName: "Boss", senderPersonId: null });

describe("runAgent", () => {
  it("searches, then proposes a complete activity with the ids it found", async () => {
    const { generate } = script(
      [{ name: "search_people", args: { query: "maria" } }, { name: "search_pipeline_items", args: { query: "padaria" } }],
      [{ name: "create_activity", args: { type: "call", subject: "Call João", due_date: "2026-10-23", due_time: "14:00", priority: "high", assigned_to_person_id: MARIA, pipeline_item_id: LEAD, remind: true } }]
    );
    const outcome = await runAgent(input, deps(generate));
    expect(outcome.kind).toBe("propose");
    if (outcome.kind !== "propose" || outcome.payload.kind !== "create") throw new Error("expected a create proposal");
    expect(outcome.payload.fields).toMatchObject({
      type: "call",
      dueDate: "2026-10-23T21:00:00.000Z",
      timezone: "America/Phoenix",
      priority: "high",
      assignedToPersonId: MARIA,
      pipelineItemId: LEAD,
      notify: true,
    });
    expect(outcome.payload.labels).toEqual({ assignee: "Maria Silva", pipelineItem: "Padaria X" });
  });

  it("refuses an id the search tools never returned, and lets the model correct itself", async () => {
    const { generate, seen } = script(
      [{ name: "create_activity", args: { type: "task", subject: "Do it", assigned_to_person_id: "99999999-9999-4999-8999-999999999999" } }],
      [{ name: "reply", args: { text: "Which Maria?" } }]
    );
    const outcome = await runAgent(input, deps(generate));
    expect(outcome).toEqual({ kind: "reply", text: "Which Maria?" });
    expect(JSON.stringify(seen[1])).toContain("not in this workspace");
  });

  it("rejects a reminder without a due date", async () => {
    const { generate, seen } = script([{ name: "create_activity", args: { type: "task", subject: "Do it", remind: true } }], [{ name: "ignore", args: {} }]);
    await runAgent(input, deps(generate));
    expect(JSON.stringify(seen[1])).toContain("needs a due date");
  });

  it("an edit keeps the time the activity had when only the date moves", async () => {
    const { generate } = script([{ name: "update_activity", args: { activity_id: ACTIVITY, due_date: "2026-10-26" } }]);
    const outcome = await runAgent(input, deps(generate, data([row()])));
    if (outcome.kind !== "propose" || outcome.payload.kind !== "update") throw new Error("expected an update proposal");
    expect(outcome.payload.fields.dueDate).toBe("2026-10-26T21:00:00.000Z");
    expect(outcome.payload.fields.subject).toBe("Call João");
    expect(outcome.payload.was).toBe("Call João");
  });

  it("clear empties a field", async () => {
    const { generate } = script([{ name: "update_activity", args: { activity_id: ACTIVITY, clear: ["due"] } }]);
    const outcome = await runAgent(input, deps(generate, data([row({ notify: true })])));
    if (outcome.kind !== "propose" || outcome.payload.kind !== "update") throw new Error("expected an update proposal");
    expect(outcome.payload.fields).toMatchObject({ dueDate: null, timezone: null, notify: false });
  });

  it("will not update an activity that isn't in the workspace's list", async () => {
    const { generate, seen } = script([{ name: "update_activity", args: { activity_id: ACTIVITY, priority: "low" } }], [{ name: "ignore", args: {} }]);
    expect(await runAgent(input, deps(generate, data([])))).toEqual({ kind: "ignore" });
    expect(JSON.stringify(seen[1])).toContain("No activity with that id");
  });

  it("proposes marking done, and answers questions with search_activities then reply", async () => {
    const done = script([{ name: "complete_activity", args: { activity_id: ACTIVITY } }]);
    const outcome = await runAgent(input, deps(done.generate, data([row()])));
    expect(outcome).toEqual({ kind: "propose", payload: { kind: "complete", id: ACTIVITY, subject: "Call João", done: true } });

    const ask = script([{ name: "search_activities", args: { due: "any" } }], [{ name: "reply", args: { text: "1 thing: Call João" } }]);
    const answer = await runAgent(input, deps(ask.generate, data([row()])));
    expect(answer).toEqual({ kind: "reply", text: "1 thing: Call João" });
    expect(JSON.stringify(ask.seen[1])).toContain("Call João");
  });

  it("finds activities on one specific day, and in a period, counting from the person's own today", async () => {
    const onFri = row({ id: "a1", subject: "Friday call", dueDate: new Date("2026-10-23T21:00:00.000Z") });
    const onMon = row({ id: "a2", subject: "Monday call", dueDate: new Date("2026-10-26T21:00:00.000Z") });
    const undated = row({ id: "a3", subject: "Someday", dueDate: null, timezone: null });
    const results = async (args: Record<string, unknown>) => {
      const { generate, seen } = script([{ name: "search_activities", args }], [{ name: "ignore", args: {} }]);
      await runAgent(input, deps(generate, data([onFri, onMon, undated])));
      const response = JSON.parse(JSON.stringify(seen[1])).at(-1).parts[0].functionResponse.response;
      return { total: response.total, subjects: response.results.map((r: { subject: string }) => r.subject) };
    };

    expect(await results({ due_on: "2026-10-23" })).toEqual({ total: 1, subjects: ["Friday call"] });
    expect(await results({ due_from: "2026-10-23", due_to: "2026-10-31" })).toEqual({ total: 2, subjects: ["Friday call", "Monday call"] });
    expect(await results({ due_from: "2026-10-24" })).toEqual({ total: 1, subjects: ["Monday call"] });
    expect(await results({ due: "tomorrow" })).toEqual({ total: 1, subjects: ["Friday call"] });
    expect(await results({})).toEqual({ total: 3, subjects: ["Friday call", "Monday call", "Someday"] });
  });

  it("rejects a malformed date filter so the model can fix it", async () => {
    const { generate, seen } = script([{ name: "search_activities", args: { due_on: "friday" } }], [{ name: "ignore", args: {} }]);
    await runAgent(input, deps(generate));
    expect(JSON.stringify(seen[1])).toContain("YYYY-MM-DD");
  });

  it("shows the agent the thread so far, as alternating turns ending with the new message", async () => {
    const { generate, seen } = script([{ name: "ignore", args: {} }]);
    await runAgent(
      {
        ...input,
        text: "make it friday",
        history: [
          { role: "assistant", text: "stray bot message before anyone spoke" },
          { role: "user", text: "call João tomorrow" },
          { role: "assistant", text: "New call: Call João" },
          { role: "assistant", text: "Which João?" },
        ],
      },
      deps(generate)
    );
    const contents = seen[0] as { role: string; parts: { text?: string }[] }[];
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(contents[0].parts[0].text).toBe("call João tomorrow");
    expect(contents[1].parts.map((p) => p.text)).toEqual(["New call: Call João", "Which João?"]);
    expect(contents[2].parts.at(-1)?.text).toBe("make it friday");
  });

  describe("contacts and companies", () => {
    it("proposes a new contact with its company", async () => {
      const { outcome } = await callTool("create_contact", { name: "Ana Costa", email: "ana@acme.com", phone: "555-1", organization_id: PADARIA });
      expect(outcome).toEqual({ kind: "propose", payload: { kind: "create_contact", fields: { name: "Ana Costa", email: "ana@acme.com", phone: "555-1", organizationId: PADARIA }, labels: { organization: "Padaria X" } } });
    });

    it("will not create a contact that already exists, and says which one", async () => {
      const { seen } = await callTool("create_contact", { name: "joao pereira" });
      expect(lastResponse(seen).error).toContain(JOAO);
    });

    it("creates the duplicate when the person confirmed they want one", async () => {
      const { outcome } = await callTool("create_contact", { name: "João Pereira", allow_duplicate: true });
      expect(outcome.kind).toBe("propose");
    });

    it("refuses a bad email or a company that isn't in the workspace", async () => {
      expect(lastResponse((await callTool("create_contact", { name: "Ana", email: "not-an-email" })).seen).error).toContain("email");
      expect(lastResponse((await callTool("create_contact", { name: "Ana", organization_id: "99999999-9999-4999-8999-999999999999" })).seen).error).toContain("not in this workspace");
    });

    it("an edit changes only what was said, and clear empties a field", async () => {
      const edit = await callTool("update_contact", { contact_id: JOAO, phone: "480-555-0199", clear: ["email"] });
      expect(edit.outcome).toMatchObject({ kind: "propose", payload: { kind: "update_contact", id: JOAO, was: "João Pereira", fields: { name: "João Pereira", email: null, phone: "480-555-0199", organizationId: PADARIA } } });
    });

    it("adds a scheme to a bare website, and refuses a company that exists", async () => {
      const created = await callTool("create_organization", { name: "Acme", website: "acme.com" });
      expect(created.outcome).toMatchObject({ kind: "propose", payload: { kind: "create_organization", fields: { name: "Acme", website: "https://acme.com" } } });
      expect(lastResponse((await callTool("create_organization", { name: "padaria x" })).seen).error).toContain(PADARIA);
    });

    it("edits a company, keeping the website unless told to clear it", async () => {
      const edit = await callTool("update_organization", { organization_id: PADARIA, notes: "met at the expo" });
      expect(edit.outcome).toMatchObject({ kind: "propose", payload: { kind: "update_organization", fields: { name: "Padaria X", website: "https://padaria.com", notes: "met at the expo" } } });
      const cleared = await callTool("update_organization", { organization_id: PADARIA, clear: ["website"] });
      expect(cleared.outcome).toMatchObject({ payload: { fields: { website: null } } });
    });
  });

  describe("leads and project cards", () => {
    it("lists the boards with their stages", async () => {
      const { seen } = await callTool("list_boards", {});
      const boards = lastResponse(seen).boards;
      expect(boards.map((b: { name: string; kind: string }) => [b.name, b.kind])).toEqual([["Leads", "leads"], ["Diligence", "project"]]);
      expect(boards[1].stages).toHaveLength(3);
    });

    it("lists every card with no query, filters by kind, and by stage in each card's own board", async () => {
      expect(lastResponse((await callTool("search_pipeline_items", {})).seen).total).toBe(2);
      const leads = lastResponse((await callTool("search_pipeline_items", { kind: "leads" })).seen);
      expect(leads.results.map((r: { title: string }) => r.title)).toEqual(["Padaria X"]);
      const stage = lastResponse((await callTool("search_pipeline_items", { stage: "in progress" })).seen);
      expect(stage.total).toBe(0);
      const todo = lastResponse((await callTool("search_pipeline_items", { stage: "to do" })).seen);
      expect(todo.results[0]).toMatchObject({ title: "Due diligence checklist", stage: "To do", kind: "project", board: "Diligence" });
    });

    it("finds a card from a misspelled title", async () => {
      const { seen } = await callTool("search_pipeline_items", { query: "dilligence checkist" });
      expect(lastResponse(seen).results[0].title).toBe("Due diligence checklist");
    });

    it("creates a lead on a board, resolving the stage by its label", async () => {
      const { outcome } = await callTool("create_pipeline_item", { board_id: LEADS_BOARD, title: "Bakery Z", stage: "in discussion", contact_id: JOAO });
      expect(outcome).toEqual({
        kind: "propose",
        payload: { kind: "create_card", fields: { boardId: LEADS_BOARD, title: "Bakery Z", stage: "in_discussion", contactId: JOAO, organizationId: null, notes: null }, labels: { board: "Leads", stage: "In Discussion", isLead: true, contact: "João Pereira" } },
      });
    });

    it("starts a new card in the board's first stage when none is named", async () => {
      const { outcome } = await callTool("create_pipeline_item", { board_id: PROJECTS_BOARD, title: "Lease review" });
      expect(outcome).toMatchObject({ payload: { fields: { stage: "todo" }, labels: { isLead: false } } });
    });

    it("tells the model a stage doesn't exist, listing the real ones", async () => {
      const { seen } = await callTool("create_pipeline_item", { board_id: LEADS_BOARD, title: "Bakery Z", stage: "shipped" });
      expect(lastResponse(seen).error).toContain("In Discussion (in_discussion)");
    });

    it("won't create a card with the title of one on the same board, unless confirmed", async () => {
      expect(lastResponse((await callTool("create_pipeline_item", { board_id: PROJECTS_BOARD, title: "due diligence checklist" })).seen).error).toContain(CARD);
      expect((await callTool("create_pipeline_item", { board_id: PROJECTS_BOARD, title: "Due diligence checklist", allow_duplicate: true })).outcome.kind).toBe("propose");
    });

    it("moves a card to another stage of ITS board, keeping everything else", async () => {
      const { outcome } = await callTool("update_pipeline_item", { item_id: CARD, stage: "doing" });
      expect(outcome).toMatchObject({
        kind: "propose",
        payload: { kind: "update_card", id: CARD, was: "Due diligence checklist", fields: { boardId: PROJECTS_BOARD, stage: "doing", title: "Due diligence checklist", contactId: JOAO, organizationId: PADARIA, notes: "start with the leases" }, labels: { stage: "In progress" } },
      });
    });

    it("clears a card's contact, and refuses a stage of another board", async () => {
      expect((await callTool("update_pipeline_item", { item_id: CARD, clear: ["contact"] })).outcome).toMatchObject({ payload: { fields: { contactId: null } } });
      expect(lastResponse((await callTool("update_pipeline_item", { item_id: CARD, stage: "in_discussion" })).seen).error).toContain("not a stage of Diligence");
    });
  });

  describe("notes, pipeline summary, preferences", () => {
    it("adds a note to a card, a company or a contact — only for ones in this workspace", async () => {
      const card = await callTool("add_note", { target: "card", id: CARD, text: "Landlord wants a 5-year lease" });
      expect(card.outcome).toEqual({ kind: "propose", payload: { kind: "add_note", target: "card", id: CARD, label: "Due diligence checklist", text: "Landlord wants a 5-year lease", activityType: "call" } });
      expect((await callTool("add_note", { target: "company", id: PADARIA, text: "Met at the expo" })).outcome).toMatchObject({ payload: { target: "company", label: "Padaria X" } });
      expect((await callTool("add_note", { target: "contact", id: JOAO, text: "Wants 2M", activity_type: "meeting" })).outcome).toMatchObject({ payload: { target: "contact", activityType: "meeting" } });
      expect(lastResponse((await callTool("add_note", { target: "card", id: "99999999-9999-4999-8999-999999999999", text: "x" })).seen).error).toContain("No card with that id");
    });

    it("refuses an empty or over-long note", async () => {
      expect(lastResponse((await callTool("add_note", { target: "card", id: CARD, text: "x".repeat(2001) })).seen).error).toContain("too long");
    });

    it("summarises the pipeline for the model, reading the loaders once each", async () => {
      const { seen } = await callTool("pipeline_summary", {});
      const response = lastResponse(seen);
      expect(response.newLeadsToReview).toBe(4);
      expect(response.boards.map((b: { name: string }) => b.name)).toEqual(["Leads", "Diligence"]);
      expect(response.stale.map((s: { title: string }) => s.title)).toContain("Due diligence checklist"); // untouched since September
    });

    it("hands the weekly report's numbers to the model, in the asker's zone", async () => {
      const { seen } = await callTool("weekly_report", {});
      expect(lastResponse(seen)).toEqual({ period: "Oct 15 – Oct 22", timeZone: "America/Phoenix" });
    });

    it("applies preference changes straight away, with only what was asked", async () => {
      const off = await callTool("set_notifications", { reminders: false, daily_summary: true });
      expect(off.outcome).toEqual({ kind: "settings", patch: { remindDm: false, digestDm: true } });
      expect(lastResponse((await callTool("set_notifications", {})).seen).error).toContain("Say what to change");
    });
  });

  describe("team members", () => {
    it("proposes adding someone to the team, with the optional email and role", async () => {
      const { outcome } = await callTool("create_team_person", { name: "Carlos Souza", email: "carlos@tagr.com", title: "Sales" });
      expect(outcome).toEqual({ kind: "propose", payload: { kind: "create_person", fields: { name: "Carlos Souza", email: "carlos@tagr.com", title: "Sales" } } });
      expect((await callTool("create_team_person", { name: "Carlos" })).outcome).toMatchObject({ payload: { fields: { name: "Carlos", email: null, title: null } } });
    });

    it("won't add someone who is already on the team (by name or email), or take a bad email", async () => {
      expect(lastResponse((await callTool("create_team_person", { name: "maria silva" })).seen).error).toContain("already on the team");
      expect(lastResponse((await callTool("create_team_person", { name: "Someone", email: "MARIA@tagr.com" })).seen).error).toContain("already on the team");
      expect(lastResponse((await callTool("create_team_person", { name: "Ana", email: "nope" })).seen).error).toContain("email");
    });
  });

  describe("EOS: issues and to-dos", () => {
    it("adds an issue with the defaults the schema requires", async () => {
      const { outcome } = await callTool("add_issue", { title: "Hiring is behind", owner_person_id: MARIA });
      expect(outcome).toEqual({ kind: "propose", payload: { kind: "add_issue", fields: { title: "Hiring is behind", notes: null, issueType: "problem", horizon: "short_term", ownerPersonId: MARIA }, labels: { assignee: "Maria Silva" } } });
    });

    it("rejects an unknown owner or issue type", async () => {
      expect(lastResponse((await callTool("add_issue", { title: "X", owner_person_id: "99999999-9999-4999-8999-999999999999" })).seen).error).toContain("not on this workspace's team");
      expect(lastResponse((await callTool("add_issue", { title: "X", issue_type: "wish" })).seen).error).toContain("issue_type");
    });

    it("a to-do is due in a week by default, as a date with no time, for the person named", async () => {
      const { outcome } = await callTool("add_todo", { subject: "Send the LOI", assigned_to_person_id: MARIA });
      // Today is Oct 22 (Phoenix) → Oct 29, local midnight = 07:00Z.
      expect(outcome).toEqual({ kind: "propose", payload: { kind: "add_todo", fields: { subject: "Send the LOI", assignedToPersonId: MARIA, dueDate: "2026-10-29T07:00:00.000Z" }, labels: { assignee: "Maria Silva" } } });
    });

    it("takes a given date, defaults the owner to the sender, and asks when there is neither", async () => {
      const given = await callTool("add_todo", { subject: "Call the bank", assigned_to_person_id: MARIA, due_date: "2026-11-03" });
      expect(given.outcome).toMatchObject({ payload: { fields: { dueDate: "2026-11-03T07:00:00.000Z" } } });

      const { generate } = script([{ name: "add_todo", args: { subject: "Ship it" } }]);
      const outcome = await runAgent(input, { generate, data: data(), userName: "Boss", senderPersonId: MARIA });
      expect(outcome).toMatchObject({ payload: { fields: { assignedToPersonId: MARIA } } });

      const nobody = await callTool("add_todo", { subject: "Ship it" }); // deps() has no sender
      expect(lastResponse(nobody.seen).error).toContain("don't know who");
    });

    it("lists what is open: issues, to-dos (overdue flagged) and the summary", async () => {
      const response = lastResponse((await callTool("list_traction", {})).seen);
      expect(response.issues).toEqual({ total: 1, items: [{ id: "i1", title: "Hiring is behind", type: "problem", horizon: "short_term", owner: "Maria Silva" }] });
      expect(response.todos.items).toEqual([{ id: "t1", subject: "Send the LOI", assignee: "Maria Silva", due: "2026-10-21", overdue: true }]);
      expect(response.summary.scorecard.onGoal).toBe(3);
    });
  });

  it("stays silent on ignore, and gives up politely after too many turns", async () => {
    expect(await runAgent(input, deps(script([{ name: "ignore", args: {} }]).generate))).toEqual({ kind: "ignore" });
    const loop = script(...Array.from({ length: 8 }, () => [{ name: "search_people", args: { query: "a" } }]));
    const outcome = await runAgent(input, deps(loop.generate));
    expect(outcome.kind).toBe("reply");
  });

  it("sends a voice note to the model as inline audio", async () => {
    const { generate, seen } = script([{ name: "ignore", args: {} }]);
    await runAgent({ ...input, text: "", audio: { mimeType: "audio/mp4", data: "AAAA" } }, deps(generate));
    expect(JSON.stringify(seen[0])).toContain('"inlineData":{"mimeType":"audio/mp4","data":"AAAA"}');
  });
});
