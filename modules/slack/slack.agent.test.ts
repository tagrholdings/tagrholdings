import { describe, expect, it, vi } from "vitest";
import type { GeminiTurn } from "@/lib/gemini";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { runAgent, type AgentData } from "./slack.agent";

vi.mock("@/lib/gemini", () => ({ generateGemini: vi.fn(), GeminiUnavailable: class extends Error {} }));

const MARIA = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const ACTIVITY = "33333333-3333-4333-8333-333333333333";

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
  pipelineItems: async () => [{ id: LEAD, title: "Padaria X", boardName: "Leads", boardIsSystem: true, contactName: null, organizationName: null }],
  contacts: async () => [],
  organizations: async () => [],
  activities: async () => activities,
});

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
