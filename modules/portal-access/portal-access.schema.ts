import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Leads captured through /portal's access-request gate (and the general
 * marketing contact form, which grants the same access as a side effect).
 * No `tenantId` — this is marketing-site lead capture for the Operating
 * Playbook, not CRM tenant data, so it lives behind the unscoped `db`
 * connection like rate_limit_buckets (see lib/db.ts).
 *
 * `token` is a short opaque id (not a signed JWT-style token) embedded in
 * `/portal?token=...` and mirrored into the `portal_access` cookie —
 * looking it up here is what grants access, replacing the old HMAC
 * verification in lib/access.ts.
 */
export const portalAccessRequestsTable = pgTable("portal_access_requests", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
});

export const requestPortalAccessSchema = z.object({
  name: z
    .string()
    .trim()
    .max(100)
    // No control characters: `name` ends up in the internal notification's subject line.
    .regex(/^[^\p{Cc}]*$/u)
    .optional(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});
