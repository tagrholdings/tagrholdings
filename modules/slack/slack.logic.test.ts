import { describe, expect, it } from "vitest";
import { activityIdsIn, addDays, buildDue, dueDay, matchesDue, mergeFields, normalizeText, searchByText, slackMessageText } from "./slack.logic";
import type { ProposalFields } from "./slack.types";

describe("normalizeText", () => {
  it("drops accents, case and punctuation", () => {
    expect(normalizeText("João da Padaria, Ltda.")).toBe("joao da padaria ltda");
  });
});

describe("searchByText", () => {
  const people = [
    { id: "1", name: "Maria Silva", email: "maria@tagr.com" },
    { id: "2", name: "Mariana Costa", email: "mariana@tagr.com" },
    { id: "3", name: "João Pedro", email: "jp@tagr.com" },
  ];
  const texts = (p: (typeof people)[number]) => [p.name, p.email];

  it("finds by a part of the name, ignoring accents", () => {
    expect(searchByText(people, "joao", texts).map((m) => m.item.id)).toEqual(["3"]);
  });

  it("ranks the exact name above a longer one", () => {
    expect(searchByText(people, "maria", texts).map((m) => m.item.id)[0]).toBe("1");
  });

  it("needs at least half of the words to match", () => {
    expect(searchByText(people, "maria zzz yyy xxx", texts)).toEqual([]);
    expect(searchByText(people, "maria silva", texts)[0].item.id).toBe("1");
  });

  it("returns nothing for an empty query", () => {
    expect(searchByText(people, "  ", texts)).toEqual([]);
  });
});

describe("buildDue", () => {
  it("turns a wall-clock time into the instant in the person's zone, and keeps the zone", () => {
    expect(buildDue("2026-10-23", "14:00", "America/Phoenix")).toEqual({ dueDate: "2026-10-23T21:00:00.000Z", timezone: "America/Phoenix" });
  });

  it("stores a date alone as local midnight with no zone", () => {
    expect(buildDue("2026-10-23", undefined, "America/Phoenix")).toEqual({ dueDate: "2026-10-23T07:00:00.000Z", timezone: null });
  });

  it("keeps 00:00 as a real time when one was given", () => {
    expect(buildDue("2026-10-23", "00:00", "America/Phoenix")?.timezone).toBe("America/Phoenix");
  });

  it("rejects text that isn't a date or a time", () => {
    expect(buildDue("friday", "14:00", "America/Phoenix")).toBeNull();
    expect(buildDue("2026-10-23", "25:00", "America/Phoenix")).toBeNull();
    expect(buildDue(undefined, undefined, "America/Phoenix")).toBeNull();
  });
});

describe("mergeFields", () => {
  const current: ProposalFields = {
    type: "call",
    subject: "Call João",
    dueDate: "2026-10-23T21:00:00.000Z",
    timezone: "America/Phoenix",
    priority: "high",
    notes: "ask about the lease",
    assignedToPersonId: "11111111-1111-4111-8111-111111111111",
    assignedToContactId: null,
    pipelineItemId: "22222222-2222-4222-8222-222222222222",
    contactId: null,
    organizationId: null,
    rockId: "33333333-3333-4333-8333-333333333333",
    notify: true,
  };

  it("changes only what the patch names", () => {
    const merged = mergeFields(current, { priority: "low" });
    expect(merged.priority).toBe("low");
    expect(merged.subject).toBe("Call João");
    expect(merged.rockId).toBe(current.rockId);
  });

  it("assigning to a contact clears the team-member assignee, and the other way round", () => {
    const toContact = mergeFields(current, { assignedToContactId: "44444444-4444-4444-8444-444444444444" });
    expect(toContact.assignedToPersonId).toBeNull();
    const toPerson = mergeFields(toContact, { assignedToPersonId: "11111111-1111-4111-8111-111111111111" });
    expect(toPerson.assignedToContactId).toBeNull();
  });

  it("clearing the due date turns the reminder off and drops the zone", () => {
    const merged = mergeFields(current, { dueDate: null });
    expect(merged.notify).toBe(false);
    expect(merged.timezone).toBeNull();
  });
});

describe("addDays / dueDay", () => {
  it("adds calendar days across a month end", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-22", -22)).toBe("2026-09-30");
  });

  it("reads an activity's day in the zone it was entered in, else the person's", () => {
    // 23:30 Phoenix on the 22nd is already the 23rd in UTC.
    expect(dueDay("2026-10-23T06:30:00.000Z", "America/Phoenix", "UTC")).toBe("2026-10-22");
    expect(dueDay("2026-10-23T06:30:00.000Z", null, "America/Phoenix")).toBe("2026-10-22");
    expect(dueDay("2026-10-23T06:30:00.000Z", null, "UTC")).toBe("2026-10-23");
  });
});

describe("matchesDue", () => {
  const today = "2026-10-22";

  it("passes anything with no filter, and nothing without a date once filtered", () => {
    expect(matchesDue(null, today, {})).toBe(true);
    expect(matchesDue(null, today, { window: "today" })).toBe(false);
    expect(matchesDue(null, today, { on: "2026-10-23" })).toBe(false);
  });

  it("knows the named windows from the person's own today", () => {
    expect(matchesDue("2026-10-21", today, { window: "overdue" })).toBe(true);
    expect(matchesDue("2026-10-22", today, { window: "overdue" })).toBe(false);
    expect(matchesDue("2026-10-22", today, { window: "today" })).toBe(true);
    expect(matchesDue("2026-10-23", today, { window: "tomorrow" })).toBe(true);
    expect(matchesDue("2026-10-29", today, { window: "this_week" })).toBe(true);
    expect(matchesDue("2026-10-30", today, { window: "this_week" })).toBe(false);
  });

  it("finds one specific day", () => {
    expect(matchesDue("2026-10-28", today, { on: "2026-10-28" })).toBe(true);
    expect(matchesDue("2026-10-29", today, { on: "2026-10-28" })).toBe(false);
  });

  it("finds a range, closed or open on either end, ends included", () => {
    expect(matchesDue("2026-11-01", today, { from: "2026-11-01", to: "2026-11-30" })).toBe(true);
    expect(matchesDue("2026-11-30", today, { from: "2026-11-01", to: "2026-11-30" })).toBe(true);
    expect(matchesDue("2026-12-01", today, { from: "2026-11-01", to: "2026-11-30" })).toBe(false);
    expect(matchesDue("2027-01-01", today, { from: "2026-11-01" })).toBe(true);
    expect(matchesDue("2026-09-01", today, { to: "2026-10-01" })).toBe(true);
  });

  it("a specific day wins over a window", () => {
    expect(matchesDue("2026-10-28", today, { window: "today", on: "2026-10-28" })).toBe(true);
  });
});

describe("slackMessageText / activityIdsIn", () => {
  it("flattens a card's blocks into readable lines", () => {
    const text = slackMessageText({
      text: "fallback",
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "New call: *Call João*" } },
        { type: "section", fields: [{ type: "mrkdwn", text: "*Due*\nFri, Oct 23 · 2:00 PM" }, { type: "mrkdwn", text: "*Assigned to*\nMaria" }] },
        { type: "actions", elements: [] },
      ],
    });
    expect(text).toBe("New call: Call João\nDue: Fri, Oct 23 · 2:00 PM\nAssigned to: Maria");
  });

  it("falls back to the plain text when there are no blocks", () => {
    expect(slackMessageText({ text: "I found *two* Marias" })).toBe("I found two Marias");
  });

  it("finds the activity ids a saved card links to, once each", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const link = `✅ Created Call João · <https://x/w/tagr/activities?activity=${id}|Open in the CRM>`;
    expect(activityIdsIn([link, link, "nothing here"])).toEqual([id]);
  });
});
