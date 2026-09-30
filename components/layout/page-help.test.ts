import { describe, expect, it } from "vitest";
import { getPageHelp } from "./page-help";

const ctx = { inboxAddress: "leads@example.test" };

describe("getPageHelp", () => {
  it("picks the most specific page", () => {
    expect(getPageHelp("/leads-inbox", ctx)?.title).toBe("Leads Inbox");
    expect(getPageHelp("/leads-inbox/listing-sites", ctx)?.title).toBe("Listing sites");
    expect(getPageHelp("/leads", ctx)?.title).toBe("Leads");
  });

  it("uses the parent page for a detail route and ignores a trailing slash", () => {
    expect(getPageHelp("/contacts/123", ctx)?.title).toBe("Contacts");
    expect(getPageHelp("/settings/inbox/", ctx)?.title).toBe("Inbox");
  });

  it("does not confuse /leads with /leads-inbox", () => {
    expect(getPageHelp("/leads-inbox/profiles", ctx)?.title).toBe("Search profiles");
  });

  it("has nothing for an unknown page", () => {
    expect(getPageHelp("/nope", ctx)).toBeNull();
    expect(getPageHelp(null, ctx)).toBeNull();
  });

  it("shows the inbox address when one is configured", () => {
    const text = JSON.stringify(getPageHelp("/leads-inbox/email-sources", ctx));
    expect(text).toContain("leads@example.test");
    expect(JSON.stringify(getPageHelp("/leads-inbox/email-sources", { inboxAddress: null }))).not.toContain("leads@");
  });
});
