import { describe, expect, it } from "vitest";
import { buildDue, mergeFields, normalizeText, searchByText } from "./slack.logic";
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
