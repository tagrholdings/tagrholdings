import { describe, expect, it } from "vitest";
import { groupReceivedEmails, type EmailDigestRow } from "./received-emails";

const head = (from: string, subject: string) => `From: ${from}\nSubject: ${subject}\n\nbody`;
const row = (over: Partial<EmailDigestRow>): EmailDigestRow => ({
  id: "l1",
  dedupeKey: "email:e1:0",
  businessName: "HVAC Co",
  sourceUrl: "https://b.test/1",
  extractedFields: {},
  status: "new",
  createdAt: new Date("2026-09-30T10:00:00Z"),
  head: head("Broker <a@b.test>", "New listings"),
  ...over,
});

describe("groupReceivedEmails", () => {
  it("groups the listings of one email, in the order they appeared, with the sender and subject", () => {
    const [email] = groupReceivedEmails([
      row({ id: "b", dedupeKey: "email:e1:1", businessName: "Second" }),
      row({ id: "a", dedupeKey: "email:e1:0", businessName: "First", extractedFields: { location: { city: "Mesa", state: "AZ" }, askingPrice: "$500,000" } }),
    ]);
    expect(email).toMatchObject({ emailId: "e1", from: "Broker <a@b.test>", subject: "New listings", outcome: "read" });
    expect(email.listings.map((l) => l.businessName)).toEqual(["First", "Second"]);
    expect(email.listings[0]).toMatchObject({ location: "Mesa, AZ", askingPrice: "$500,000" });
  });

  it("separates emails and puts the newest first", () => {
    const emails = groupReceivedEmails([
      row({ id: "old", dedupeKey: "email:old:0", createdAt: new Date("2026-09-01T00:00:00Z") }),
      row({ id: "new", dedupeKey: "email:new:0", createdAt: new Date("2026-09-30T00:00:00Z") }),
    ]);
    expect(emails.map((e) => e.emailId)).toEqual(["new", "old"]);
  });

  it("tells an email with no listing in it from one that could not be read", () => {
    const [nothing, failed] = groupReceivedEmails([
      row({ id: "n", dedupeKey: "email:n", extractedFields: { summary: "No business for sale was recognised in this email." }, createdAt: new Date("2026-09-30T02:00:00Z") }),
      row({ id: "f", dedupeKey: "email:f", extractedFields: { summary: "The email could not be read automatically — open it to see what it says." }, createdAt: new Date("2026-09-30T01:00:00Z") }),
    ]);
    expect(nothing).toMatchObject({ outcome: "nothing", listings: [], fallbackLeadId: "n" });
    expect(failed).toMatchObject({ outcome: "failed", fallbackLeadId: "f" });
  });

  it("only lets http(s) links through and copes with a missing header", () => {
    const [email] = groupReceivedEmails([row({ sourceUrl: "javascript:alert(1)", head: "no header here" })]);
    expect(email.listings[0].link).toBeNull();
    expect(email).toMatchObject({ from: "Unknown sender", subject: "(no subject)" });
  });
});
