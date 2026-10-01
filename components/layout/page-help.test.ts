import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { getPageHelp, helpRoutes, tourTargets } from "./page-help";

const ctx = { inboxAddress: "leads@example.test" };
const ROOT = join(__dirname, "..", "..");

function walk(dir: string, match: (path: string) => boolean): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full, match));
    else if (match(full)) found.push(full);
  }
  return found;
}

/**
 * Every `app/(hub)/w/[workspace]` page turned into the (workspace-relative) route it serves:
 * `app/(hub)/w/[workspace]/settings/inbox/page.tsx` -> `/settings/inbox`.
 */
function hubRoutes(): string[] {
  const hub = join(ROOT, "app", "(hub)", "w", "[workspace]");
  return walk(hub, (p) => p.endsWith(`${sep}page.tsx`))
    .map((p) => relative(hub, p).replace(new RegExp(`\\${sep}`, "g"), "/").replace(/\/?page\.tsx$/, ""))
    .map((route) => `/${route}`.replace(/\/+$/, "") || "/");
}

/**
 * Pages that deliberately have no help: they render nothing of their own.
 * Adding a route here needs a reason — it is not a way to skip writing help.
 */
const NO_HELP_NEEDED = new Set([
  "/settings", // redirects straight to /settings/notifications
]);

function sourceFiles(): string[] {
  return [join(ROOT, "app"), join(ROOT, "components")].flatMap((dir) => walk(dir, (p) => p.endsWith(".tsx")));
}

/** Both ways a component names itself for the tour: the attribute, and the `tourId` prop shared components take. */
function declaredTargets(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:data-tour|tourId)=["{]"?([a-z0-9-]+)"/g)) {
      const name = match[1];
      found.set(name, [...(found.get(name) ?? []), relative(ROOT, file)]);
    }
  }
  return found;
}

describe("getPageHelp", () => {
  it("ignores the /w/<workspace> part of the URL", () => {
    expect(getPageHelp("/w/acme/leads-inbox", ctx)?.title).toBe("Leads Inbox");
    expect(getPageHelp("/w/acme/contacts/123", ctx)?.title).toBe("Contact");
    expect(getPageHelp("/w/acme/settings/members", ctx)?.title).toBe("Members");
  });

  it("picks the most specific page", () => {
    expect(getPageHelp("/leads-inbox", ctx)?.title).toBe("Leads Inbox");
    expect(getPageHelp("/leads-inbox/listing-sites", ctx)?.title).toBe("Listing sites");
    expect(getPageHelp("/leads", ctx)?.title).toBe("Leads");
  });

  it("gives a detail route its own help (a [param] folder matches any id), and ignores a trailing slash", () => {
    expect(getPageHelp("/contacts/123", ctx)?.title).toBe("Contact");
    expect(getPageHelp("/contacts", ctx)?.title).toBe("Contacts");
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

/**
 * These three keep `page-help.ts` honest as the app changes. A new page with no help, a renamed control, or a
 * `data-tour` left behind by a deleted step all fail here rather than silently shipping a broken tour.
 */
describe("every page is covered", () => {
  it("has help and at least one tour step", () => {
    const missing = hubRoutes()
      .filter((route) => !NO_HELP_NEEDED.has(route))
      .filter((route) => {
        const help = getPageHelp(route, ctx);
        return !help || help.tour.length === 0;
      });
    expect(missing, `add these routes to components/layout/page-help.ts (with a tour): ${missing.join(", ")}`).toEqual([]);
  });

  it("only lists routes that still exist", () => {
    const routes = new Set(hubRoutes());
    const stale = helpRoutes().filter((path) => !routes.has(path));
    expect(stale, `these help entries point at pages that are gone: ${stale.join(", ")}`).toEqual([]);
  });
});

describe("tour targets match the components", () => {
  it("every step points at an element that exists in the code", () => {
    const declared = declaredTargets();
    const dangling = tourTargets().filter((target) => !declared.has(target));
    expect(dangling, `no data-tour="…" found for: ${dangling.join(", ")}`).toEqual([]);
  });

  it("no data-tour is left over from a step that was removed", () => {
    const used = new Set(tourTargets());
    const orphans = [...declaredTargets().entries()].filter(([name]) => !used.has(name)).map(([name, files]) => `${name} (${files[0]})`);
    expect(orphans, `these data-tour attributes are pointed at by no tour step: ${orphans.join(", ")}`).toEqual([]);
  });
});
