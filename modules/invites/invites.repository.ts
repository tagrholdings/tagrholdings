import { and, desc, eq, isNull } from "drizzle-orm";
import { db, withTenant } from "@/lib/db";
import { invitesTable } from "./invites.schema";

export const invitesRepository = {
  // ── Tenant-scoped: a signed-in member managing their workspace's invites (RLS applies via withTenant). ──

  async findAllForTenant(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx.select().from(invitesTable).where(eq(invitesTable.tenantId, tenantId)).orderBy(desc(invitesTable.createdAt))
    );
  },

  async findById(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.select().from(invitesTable).where(and(eq(invitesTable.tenantId, tenantId), eq(invitesTable.id, id)))
    );
    return row;
  },

  async findOpenByEmail(tenantId: string, email: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(invitesTable)
        .where(
          and(eq(invitesTable.tenantId, tenantId), eq(invitesTable.email, email), isNull(invitesTable.acceptedAt), isNull(invitesTable.revokedAt))
        )
    );
    return row;
  },

  async create(tenantId: string, values: { email: string; role: string; tokenHash: string; invitedByUserId: string; expiresAt: Date }) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(invitesTable).values({ ...values, tenantId }).returning());
    return row;
  },

  /** Issues a fresh link on an open invite: the old token stops working the moment its hash is replaced. */
  async rotate(tenantId: string, id: string, values: { tokenHash: string; expiresAt: Date; now: Date }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(invitesTable)
        .set({ tokenHash: values.tokenHash, expiresAt: values.expiresAt, lastSentAt: values.now })
        .where(and(eq(invitesTable.tenantId, tenantId), eq(invitesTable.id, id), isNull(invitesTable.acceptedAt), isNull(invitesTable.revokedAt)))
        .returning()
    );
    return row;
  },

  async revoke(tenantId: string, id: string, now: Date) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(invitesTable)
        .set({ revokedAt: now })
        .where(and(eq(invitesTable.tenantId, tenantId), eq(invitesTable.id, id), isNull(invitesTable.acceptedAt), isNull(invitesTable.revokedAt)))
        .returning()
    );
    return row;
  },

  // ── Unscoped (`db`): whoever opens an emailed link has no session, so the tenant isn't known until the ──
  // ── token has been found. Every query here is keyed by the token's hash (or an id already resolved from it). ──

  async findByTokenHash(tokenHash: string) {
    const [row] = await db.select().from(invitesTable).where(eq(invitesTable.tokenHash, tokenHash));
    return row;
  },

  /** Marks the invite accepted — but only if it is still open, so two simultaneous submissions can't both win. */
  async claim(id: string, now: Date) {
    const [row] = await db
      .update(invitesTable)
      .set({ acceptedAt: now })
      .where(and(eq(invitesTable.id, id), isNull(invitesTable.acceptedAt), isNull(invitesTable.revokedAt)))
      .returning();
    return row;
  },

  /** Undoes `claim` when creating the account failed, so the link can be used again. */
  async releaseClaim(id: string) {
    await db.update(invitesTable).set({ acceptedAt: null }).where(eq(invitesTable.id, id));
  },

  /** Public re-send from an expired link: the same open-invite rotation, addressed by id. */
  async rotateById(id: string, values: { tokenHash: string; expiresAt: Date; now: Date }) {
    const [row] = await db
      .update(invitesTable)
      .set({ tokenHash: values.tokenHash, expiresAt: values.expiresAt, lastSentAt: values.now })
      .where(and(eq(invitesTable.id, id), isNull(invitesTable.acceptedAt), isNull(invitesTable.revokedAt)))
      .returning();
    return row;
  },
};
