import { z } from "zod";

export const WORKSPACE_ROLES = ["admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const PLATFORM_ROLES = ["super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** `/w/<slug>/…` — first and last char alphanumeric, hyphens inside, 3–40 chars. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Top-level paths and words a workspace can't take as its slug (they'd read as routes, or confuse the address). */
export const RESERVED_SLUGS = new Set(["admin", "api", "auth", "new", "settings", "workspaces", "w", "home", "share", "portal", "docs"]);

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !slug.includes("--") && !RESERVED_SLUGS.has(slug);
}

/** "Menlo CRE & Co." -> "menlo-cre-co". Empty when nothing usable is left. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().refine(isValidSlug, "Use 3–40 lowercase letters, numbers and single hyphens (not a reserved word)."),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Super admin → "Create workspace": the workspace plus (optionally) the first admin, who is invited by email. */
export const createWorkspaceWithAdminSchema = createWorkspaceSchema.extend({
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .optional(),
});
export type CreateWorkspaceWithAdminInput = z.input<typeof createWorkspaceWithAdminSchema>;

/** The text a super admin must type, besides the workspace's name, to archive or delete it (the Vercel-style double confirmation). */
export const ARCHIVE_PHRASE = "archive workspace";
export const DELETE_PHRASE = "delete workspace";

export const renameWorkspaceSchema = z.object({ id: z.uuid(), name: z.string().trim().min(2, "Enter a name.").max(80) });

export const inviteToWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  role: workspaceRoleSchema.default("member"),
});

/** The two things typed to confirm a destructive action: the workspace's exact name and the action phrase. */
const confirmationFields = { confirmName: z.string().max(200), confirmPhrase: z.string().max(100) };
export const archiveWorkspaceSchema = z.object({ id: z.uuid(), ...confirmationFields });
export const deleteWorkspaceSchema = z.object({ id: z.uuid(), ...confirmationFields });
export const unarchiveWorkspaceSchema = z.object({ id: z.uuid() });
export type WorkspaceConfirmation = { confirmName: string; confirmPhrase: string };

/** Row shape for /admin. */
export interface WorkspaceAdminRow {
  id: string;
  name: string;
  slug: string;
  inboundLocalPart: string;
  archivedAt: Date | null;
  memberCount: number;
}

export const changeMemberRoleSchema = z.object({ userId: z.string().min(1).max(100), role: workspaceRoleSchema });
export const removeMemberSchema = z.object({ userId: z.string().min(1).max(100) });

/** Who this workspace's email signups sign up as (read by the lead engine). Blank = not set. */
export const buyerIdentitySchema = z.object({
  buyerName: z.string().trim().max(120).optional(),
  buyerPhone: z.string().trim().max(40).optional(),
  buyerCompany: z.string().trim().max(120).optional(),
});
export type BuyerIdentityInput = z.input<typeof buyerIdentitySchema>;

/** Client-side row shape for Settings → Members. */
export interface MemberSummary {
  id: string;
  name: string | null;
  email: string;
  role: WorkspaceRole;
}
