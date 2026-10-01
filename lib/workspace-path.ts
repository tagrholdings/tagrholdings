/**
 * Pure helpers for the `/w/<slug>/…` URL scheme — no imports, so the edge proxy, server code and client components can
 * all use them. Every in-app link to a hub page goes through `workspacePath` instead of a hard-coded "/contacts".
 */

export const WORKSPACE_PREFIX = "/w";

/**
 * Set by proxy.ts from the URL (`/w/<slug>/…`) on every request, so a Server Action — which is POSTed to the page's own
 * URL and otherwise has no idea which workspace it is acting in — can read it. It is only an address: the action
 * re-checks the caller's access to that workspace every time (safe-action.ts). The proxy always overwrites it, so a
 * client-supplied value never gets through.
 */
export const WORKSPACE_HEADER = "x-workspace";

/** `workspacePath("acme", "/contacts?tab=orgs")` → `/w/acme/contacts?tab=orgs`. `path` starts with "/" (or is ""). */
export function workspacePath(slug: string, path = ""): string {
  return `${WORKSPACE_PREFIX}/${slug}${path}`;
}

/** `/w/acme/contacts/123` → `{ slug: "acme", path: "/contacts/123" }`; null when the pathname isn't a workspace URL. */
export function parseWorkspacePath(pathname: string | null | undefined): { slug: string; path: string } | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/w\/([^/?#]+)(\/[^?#]*)?/);
  if (!match) return null;
  return { slug: match[1], path: match[2] ?? "" };
}

/** The part of a pathname after `/w/<slug>` (or the pathname itself when it isn't a workspace URL). */
export function stripWorkspacePrefix(pathname: string): string {
  return parseWorkspacePath(pathname)?.path ?? pathname;
}

/** Same page, different workspace — what the switcher navigates to (`/w/a/contacts` → `/w/b/contacts`). */
export function switchWorkspacePath(pathname: string | null | undefined, nextSlug: string): string {
  const parsed = parseWorkspacePath(pathname);
  return workspacePath(nextSlug, parsed && parsed.path !== "" ? parsed.path : "/activities");
}

/** The hub sections that live under a workspace — also what the legacy (pre-workspace) URLs map from. */
export const WORKSPACE_SECTIONS = ["activities", "contacts", "pipeline", "leads", "leads-inbox", "settings", "docs"] as const;

/** Is `path` ("/contacts/12") inside one of the workspace sections? Guards redirects built from user-supplied paths. */
export function isWorkspaceSectionPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  const first = path.split(/[/?#]/)[1];
  return (WORKSPACE_SECTIONS as readonly string[]).includes(first);
}
