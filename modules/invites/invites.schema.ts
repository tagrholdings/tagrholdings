import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable, tenantIsolationPolicy } from "@/modules/tenancy/tenancy.schema";

/**
 * An invitation to create an account in a workspace. The emailed link carries a random token; only its SHA-256
 * (`tokenHash`) is stored, so a database leak doesn't leak working links.
 *
 * Lifecycle: pending (open, `expiresAt` in the future) → accepted (`acceptedAt`), or revoked (`revokedAt`), or
 * expired (`expiresAt` passed — it can be re-sent, which issues a new token and a new expiry on the same row).
 * A row is never deleted. `email` is stored lowercased.
 *
 * `userId`s are Neon Auth ids (no FK possible — see activities.schema.ts's assignedToUserId).
 */
export const invitesTable = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    email: text("email").notNull(),
    /** The role the person gets in the workspace when they accept: "admin" | "member". */
    role: text("role").notNull().default("member"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    /** When the current link was last emailed (a resend moves it). */
    lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // At most one open invite per person per workspace — inviting again re-sends that one instead of piling up links.
    uniqueIndex("invites_open_email_idx")
      .on(t.tenantId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    tenantIsolationPolicy("invites"),
  ]
);
