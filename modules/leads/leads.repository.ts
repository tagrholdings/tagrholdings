import { withTenant } from "@/lib/db";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { rawLeadsTable, type ExtractedFields, type LeadSourceType, type RawLeadStatus } from "./leads.schema";
import { searchProfilesTable } from "@/modules/search-profiles/search-profiles.schema";

// rawText (the full scraped page text, kept for audit/reprocessing) is never
// selected here — nothing in the app reads it, and it's the largest column.
const summaryColumns = {
  id: rawLeadsTable.id,
  sourceType: rawLeadsTable.sourceType,
  sourceUrl: rawLeadsTable.sourceUrl,
  businessName: rawLeadsTable.businessName,
  extractedFields: rawLeadsTable.extractedFields,
  status: rawLeadsTable.status,
  searchProfileId: rawLeadsTable.searchProfileId,
  searchProfileName: searchProfilesTable.name,
  searchProfileCriteria: searchProfilesTable.criteria,
  pipelineItemId: rawLeadsTable.pipelineItemId,
  createdAt: rawLeadsTable.createdAt,
};

const LIST_LIMIT = 500;

export interface NewRawLead {
  sourceType: LeadSourceType;
  sourceUrl: string | null;
  businessName: string;
  rawText: string;
  extractedFields: ExtractedFields;
  dedupeKey: string;
}

export const leadsRepository = {
  /** Idempotent insert (unique on tenant + source + dedupe key): resolves undefined when the lead already exists. */
  async createIfNew(tenantId: string, data: NewRawLead): Promise<{ id: string } | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(rawLeadsTable)
        .values({ ...data, tenantId })
        .onConflictDoNothing({ target: [rawLeadsTable.tenantId, rawLeadsTable.sourceType, rawLeadsTable.dedupeKey] })
        .returning({ id: rawLeadsTable.id })
    );
    return row;
  },

  async findIdByDedupeKey(tenantId: string, sourceType: LeadSourceType, dedupeKey: string): Promise<string | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: rawLeadsTable.id })
        .from(rawLeadsTable)
        .where(and(eq(rawLeadsTable.tenantId, tenantId), eq(rawLeadsTable.sourceType, sourceType), eq(rawLeadsTable.dedupeKey, dedupeKey)))
    );
    return row?.id;
  },

  /**
   * True when any lead was already saved from this exact email: a single-lead key `email:<id>` or a per-listing key
   * `email:<id>:<n>`. Webhooks are retried and replayable, so this is what stops a redelivery from paying for the AI again.
   */
  async existsForEmail(tenantId: string, emailId: string): Promise<boolean> {
    const key = `email:${emailId}`;
    // LIKE wildcards in an id would widen the match: only ids made of plain characters get the prefix form.
    const prefixSafe = /^[A-Za-z0-9_-]+$/.test(emailId);
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: rawLeadsTable.id })
        .from(rawLeadsTable)
        .where(
          and(
            eq(rawLeadsTable.tenantId, tenantId),
            eq(rawLeadsTable.sourceType, "email_digest"),
            prefixSafe ? or(eq(rawLeadsTable.dedupeKey, key), like(rawLeadsTable.dedupeKey, `${key}:%`)) : eq(rawLeadsTable.dedupeKey, key)
          )
        )
        .limit(1)
    );
    return row !== undefined;
  },

  /** A listing already saved from an earlier digest (matched by the signature stored in its extracted fields). */
  async findIdByListingSignature(tenantId: string, signature: string): Promise<string | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: rawLeadsTable.id })
        .from(rawLeadsTable)
        .where(
          and(
            eq(rawLeadsTable.tenantId, tenantId),
            eq(rawLeadsTable.sourceType, "email_digest"),
            sql`${rawLeadsTable.extractedFields}->>'listingSignature' = ${signature}`
          )
        )
        .limit(1)
    );
    return row?.id;
  },

  async findAllForTenant(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select(summaryColumns)
        .from(rawLeadsTable)
        .leftJoin(searchProfilesTable, eq(rawLeadsTable.searchProfileId, searchProfilesTable.id))
        .where(eq(rawLeadsTable.tenantId, tenantId))
        .orderBy(desc(rawLeadsTable.createdAt))
        .limit(LIST_LIMIT)
    );
  },

  async findById(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select(summaryColumns)
        .from(rawLeadsTable)
        .leftJoin(searchProfilesTable, eq(rawLeadsTable.searchProfileId, searchProfilesTable.id))
        .where(and(eq(rawLeadsTable.tenantId, tenantId), eq(rawLeadsTable.id, id)))
    );
    return row;
  },

  async countByStatus(tenantId: string, status: RawLeadStatus) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ value: count() })
        .from(rawLeadsTable)
        .where(and(eq(rawLeadsTable.tenantId, tenantId), eq(rawLeadsTable.status, status)))
    );
    return row?.value ?? 0;
  },

  /**
   * Moves a lead from `from` to `to` in one conditional UPDATE — returns
   * nothing if the lead isn't in `from` (already handled, e.g. a double
   * click or another tab), which is what makes promote/dismiss race-safe.
   */
  async transition(tenantId: string, id: string, from: RawLeadStatus, to: RawLeadStatus) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(rawLeadsTable)
        .set({ status: to, updatedAt: new Date() })
        .where(and(eq(rawLeadsTable.tenantId, tenantId), eq(rawLeadsTable.id, id), eq(rawLeadsTable.status, from)))
        .returning({ id: rawLeadsTable.id })
    );
    return row;
  },

  async linkPipelineItem(tenantId: string, id: string, pipelineItemId: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .update(rawLeadsTable)
        .set({ pipelineItemId, updatedAt: new Date() })
        .where(and(eq(rawLeadsTable.tenantId, tenantId), eq(rawLeadsTable.id, id)))
    );
  },
};
