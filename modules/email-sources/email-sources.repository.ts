import { withTenant } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { emailSourcesTable } from "./email-sources.schema";
import type { EmailSourceSummary, NewEmailSource } from "./email-sources.types";

const summaryColumns = {
  id: emailSourcesTable.id,
  siteName: emailSourcesTable.siteName,
  signupUrl: emailSourcesTable.signupUrl,
  emailFieldSelector: emailSourcesTable.emailFieldSelector,
  submitSelector: emailSourcesTable.submitSelector,
  subscribed: emailSourcesTable.subscribed,
  captchaProtected: emailSourcesTable.captchaProtected,
  notes: emailSourcesTable.notes,
  source: emailSourcesTable.source,
  subscribedAt: emailSourcesTable.subscribedAt,
  attemptRequestedAt: emailSourcesTable.attemptRequestedAt,
  lastAttemptAt: emailSourcesTable.lastAttemptAt,
  lastAttemptResult: emailSourcesTable.lastAttemptResult,
  lastAttemptError: emailSourcesTable.lastAttemptError,
  createdAt: emailSourcesTable.createdAt,
};

export const emailSourcesRepository = {
  async findAllForTenant(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx.select(summaryColumns).from(emailSourcesTable).where(eq(emailSourcesTable.tenantId, tenantId)).orderBy(asc(emailSourcesTable.siteName))
    );
  },

  async findById(tenantId: string, id: string): Promise<EmailSourceSummary | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.select(summaryColumns).from(emailSourcesTable).where(and(eq(emailSourcesTable.tenantId, tenantId), eq(emailSourcesTable.id, id)))
    );
    return row;
  },

  /** Sources still waiting for a subscription — what an incoming confirmation email is matched against. */
  async findAwaitingConfirmation(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select(summaryColumns)
        .from(emailSourcesTable)
        .where(and(eq(emailSourcesTable.tenantId, tenantId), eq(emailSourcesTable.subscribed, false)))
    );
  },

  async create(tenantId: string, data: NewEmailSource) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(emailSourcesTable)
        .values({ ...data, tenantId })
        .returning(summaryColumns)
    );
    return row;
  },

  async update(tenantId: string, id: string, data: Partial<NewEmailSource> & Partial<typeof emailSourcesTable.$inferInsert>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(emailSourcesTable)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(emailSourcesTable.tenantId, tenantId), eq(emailSourcesTable.id, id)))
        .returning(summaryColumns)
    );
    return row;
  },

  async delete(tenantId: string, id: string) {
    await withTenant(tenantId, (tx) =>
      tx.delete(emailSourcesTable).where(and(eq(emailSourcesTable.tenantId, tenantId), eq(emailSourcesTable.id, id)))
    );
  },
};
