import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./navigation";
import { inboundAddressFor, inboundLocalPartOf } from "./inbound-address";
import { isWorkspaceSectionPath, parseWorkspacePath, stripWorkspacePrefix, switchWorkspacePath, workspacePath } from "./workspace-path";

describe("workspace paths", () => {
  it("builds and parses /w/<slug>/… URLs", () => {
    expect(workspacePath("acme", "/contacts?tab=orgs")).toBe("/w/acme/contacts?tab=orgs");
    expect(workspacePath("acme")).toBe("/w/acme");
    expect(parseWorkspacePath("/w/acme/contacts/123")).toEqual({ slug: "acme", path: "/contacts/123" });
    expect(parseWorkspacePath("/w/acme")).toEqual({ slug: "acme", path: "" });
    expect(parseWorkspacePath("/contacts")).toBeNull();
    expect(parseWorkspacePath(null)).toBeNull();
  });

  it("strips the prefix and leaves anything else alone", () => {
    expect(stripWorkspacePrefix("/w/acme/settings/inbox")).toBe("/settings/inbox");
    expect(stripWorkspacePrefix("/admin")).toBe("/admin");
  });

  it("switching workspace keeps you on the same page", () => {
    expect(switchWorkspacePath("/w/acme/contacts/123", "menlo")).toBe("/w/menlo/contacts/123");
    expect(switchWorkspacePath("/w/acme", "menlo")).toBe("/w/menlo/activities");
    expect(switchWorkspacePath("/admin", "menlo")).toBe("/w/menlo/activities");
  });

  it("only redirects to the hub's own sections (the `to` of /home is user-supplied)", () => {
    expect(isWorkspaceSectionPath("/contacts/12?x=1")).toBe(true);
    expect(isWorkspaceSectionPath("/leads-inbox")).toBe(true);
    for (const bad of ["//evil.test", "https://evil.test", "/admin", "/api/x", "contacts", ""]) expect(isWorkspaceSectionPath(bad)).toBe(false);
  });

  it("nav items are active inside any workspace", () => {
    expect(isNavItemActive("/w/acme/contacts", "/contacts")).toBe(true);
    expect(isNavItemActive("/w/acme/contacts/12", "/contacts")).toBe(true);
    expect(isNavItemActive("/w/acme/leads-inbox", "/leads")).toBe(false);
    expect(isNavItemActive(null, "/contacts")).toBe(false);
  });
});

describe("inbound addresses", () => {
  it("is null until the domain is configured, then <local part>@<domain>", () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    expect(inboundAddressFor("acme-x")).toBeNull();
    process.env.INBOUND_EMAIL_DOMAIN = "In.Example.Test";
    expect(inboundAddressFor("acme-x")).toBe("acme-x@in.example.test");
  });

  it("reads the local part of our own addresses, however the recipient is written", () => {
    process.env.INBOUND_EMAIL_DOMAIN = "in.example.test";
    expect(inboundLocalPartOf("acme-x@in.example.test")).toBe("acme-x");
    expect(inboundLocalPartOf("Acme Leads <ACME-X@In.Example.Test>")).toBe("acme-x");
    expect(inboundLocalPartOf("someone@elsewhere.test")).toBeNull();
    expect(inboundLocalPartOf("acme-x@evil.in.example.test")).toBeNull();
    expect(inboundLocalPartOf("not an address")).toBeNull();
  });
});
