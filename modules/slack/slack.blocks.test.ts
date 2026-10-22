import { describe, expect, it } from "vitest";
import { CANCEL_ACTION_ID, CONFIRM_ACTION_ID, proposalBlocks } from "./slack.blocks";
import type { PendingPayload } from "./slack.types";

const ID = "11111111-1111-4111-8111-111111111111";

const card = (payload: PendingPayload) => {
  const { text, blocks } = proposalBlocks(payload, "tenant.pending", "America/Phoenix");
  const all = JSON.stringify(blocks);
  const buttons = (blocks as { type: string; elements?: { action_id: string; value: string; text: { text: string } }[] }[]).find((b) => b.type === "actions")!.elements!;
  return { text, all, buttons };
};

describe("proposalBlocks", () => {
  it("puts the same value on Confirm and Cancel and nothing else", () => {
    const { buttons } = card({ kind: "complete", id: ID, subject: "Call João", done: true });
    expect(buttons.map((b) => [b.action_id, b.value])).toEqual([[CONFIRM_ACTION_ID, "tenant.pending"], [CANCEL_ACTION_ID, "tenant.pending"]]);
  });

  it("shows a contact with its company", () => {
    const { text, all, buttons } = card({ kind: "create_contact", fields: { name: "Ana Costa", email: "ana@acme.com", phone: "555", organizationId: ID }, labels: { organization: "Acme" } });
    expect(text).toBe("New contact: Ana Costa");
    expect(all).toContain("ana@acme.com");
    expect(all).toContain("Acme");
    expect(buttons[0].text.text).toBe("Create");
  });

  it("calls a card on the Leads board a lead, and any other a project card, with its stage", () => {
    const fields = { boardId: ID, title: "Bakery Z", stage: "sourced", contactId: null, organizationId: null, notes: null };
    expect(card({ kind: "create_card", fields, labels: { board: "Leads", stage: "Sourced", isLead: true } }).text).toBe("New lead: Bakery Z");
    const project = card({ kind: "update_card", id: ID, was: "Bakery Z", fields, labels: { board: "Diligence", stage: "In progress", isLead: false } });
    expect(project.text).toBe("Update project card: Bakery Z");
    expect(project.all).toContain("In progress");
    expect(project.buttons[0].text.text).toBe("Save changes");
  });

  it("shows a new team member, as a team member and not a contact", () => {
    const { text, all, buttons } = card({ kind: "create_person", fields: { name: "Carlos Souza", email: "carlos@tagr.com", title: "Sales" } });
    expect(text).toBe("Add to the team: Carlos Souza");
    expect(all).toContain("Sales");
    expect(buttons[0].text.text).toBe("Add to the team");
  });

  it("keeps user text from making links or mentions", () => {
    const { all } = card({ kind: "create_organization", fields: { name: "<!channel> & <https://evil.example|click>", website: null, notes: null } });
    expect(all).not.toContain("<!channel>");
    expect(all).toContain("&lt;!channel&gt;");
  });
});
