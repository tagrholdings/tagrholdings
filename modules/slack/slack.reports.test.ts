import { describe, expect, it } from "vitest";
import type { ActivityRow } from "@/modules/activities/activities.types";
import { summarizePipeline, type SummaryBoard, type SummaryItem } from "./slack.reports";

const NOW = new Date("2026-10-22T19:00:00Z"); // Thursday 12:00 in Phoenix
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const boards: SummaryBoard[] = [
  { id: "leads", name: "Leads", isSystem: true, archivedAt: null, columns: [{ id: "sourced", label: "Sourced" }, { id: "outreach", label: "Outreach" }, { id: "closed", label: "Closed" }] },
  { id: "dd", name: "Diligence", isSystem: false, archivedAt: null, columns: [{ id: "todo", label: "To do" }, { id: "done", label: "Done" }] },
  { id: "old", name: "Old", isSystem: false, archivedAt: new Date(), columns: [{ id: "x", label: "X" }] },
];
const item = (id: string, over: Partial<SummaryItem> = {}): SummaryItem => ({
  id, title: `Card ${id}`, boardId: "leads", stage: "sourced", boardName: "Leads", boardIsSystem: true, createdAt: daysAgo(30), updatedAt: daysAgo(1), ...over,
});
const activity = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: "a", type: "task", subject: "S", dueDate: null, timezone: null, createdAt: daysAgo(10), done: false, priority: null, notes: null,
  contactId: null, contactName: null, organizationId: null, organizationName: null, pipelineItemId: null, pipelineItemTitle: null, rockId: null, rockTitle: null,
  assignedToPersonId: null, assignedToContactId: null, assignedToContactName: null, notify: false, l10Todo: false, ...over,
});
const summarize = (items: SummaryItem[], activities: ActivityRow[] = [], newLeads = 0) => summarizePipeline({ items, boards, activities, newLeads, now: NOW, timeZone: "America/Phoenix" });

describe("summarizePipeline", () => {
  it("counts cards per stage of each live board (archived boards are left out)", () => {
    const s = summarize([item("1"), item("2", { stage: "outreach" }), item("3", { boardId: "dd", stage: "todo", boardName: "Diligence", boardIsSystem: false })]);
    expect(s.boards.map((b) => b.name)).toEqual(["Leads", "Diligence"]);
    expect(s.boards[0]).toMatchObject({ isLeads: true, total: 2, stages: [{ label: "Sourced", count: 1 }, { label: "Outreach", count: 1 }, { label: "Closed", count: 0 }] });
    expect(s.boards[1].total).toBe(1);
  });

  it("lists cards created in the last seven days", () => {
    const s = summarize([item("1", { createdAt: daysAgo(2) }), item("2", { createdAt: daysAgo(8) }), item("3", { createdAt: daysAgo(6) })]);
    expect(s.createdLast7Days).toEqual({ count: 2, titles: ["Card 1", "Card 3"] });
  });

  it("calls a card stale after 14 days untouched — never one in its board's last stage — longest idle first", () => {
    const s = summarize([
      item("fresh", { updatedAt: daysAgo(13) }),
      item("old", { updatedAt: daysAgo(20) }),
      item("older", { updatedAt: daysAgo(40), stage: "outreach" }),
      item("finished", { updatedAt: daysAgo(90), stage: "closed" }),
    ]);
    expect(s.stale.map((c) => [c.title, c.daysIdle, c.stage])).toEqual([["Card older", 40, "Outreach"], ["Card old", 20, "Sourced"]]);
    expect(s.staleTotal).toBe(2);
  });

  it("caps the stale list at ten but still counts them all", () => {
    const many = Array.from({ length: 13 }, (_, i) => item(String(i), { updatedAt: daysAgo(20 + i) }));
    const s = summarize(many);
    expect(s.stale).toHaveLength(10);
    expect(s.staleTotal).toBe(13);
  });

  it("counts activities overdue / due today in the asker's time zone, and done this week by updatedAt", () => {
    const s = summarize([], [
      activity({ id: "1", dueDate: new Date("2026-10-21T07:00:00Z") }), // Oct 21 (Phoenix) → overdue
      activity({ id: "2", dueDate: new Date("2026-10-22T07:00:00Z") }), // Oct 22 (Phoenix) → today
      activity({ id: "3", dueDate: new Date("2026-10-23T07:00:00Z") }), // tomorrow
      activity({ id: "4" }), // no date: neither
      activity({ id: "5", done: true, dueDate: new Date("2026-10-01T07:00:00Z"), updatedAt: daysAgo(2) }), // done, doesn't count as overdue
      activity({ id: "6", done: true, updatedAt: daysAgo(10) }),
    ]);
    expect(s.activities).toEqual({ overdue: 1, dueToday: 1, doneLast7Days: 1 });
  });

  it("carries the new-leads count through", () => {
    expect(summarize([], [], 7).newLeadsToReview).toBe(7);
  });
});
