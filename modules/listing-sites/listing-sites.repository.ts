import { withTenant } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { listingSitesTable, type ListingSiteOrigin } from "./listing-sites.schema";
import type { ListingSiteSummary } from "./listing-sites.types";

// contentHashes is job bookkeeping — never sent to the client.
const summaryColumns = {
  id: listingSitesTable.id,
  siteName: listingSitesTable.siteName,
  domain: listingSitesTable.domain,
  siteUrl: listingSitesTable.siteUrl,
  listingsUrl: listingSitesTable.listingsUrl,
  source: listingSitesTable.source,
  active: listingSitesTable.active,
  status: listingSitesTable.status,
  statusDetail: listingSitesTable.statusDetail,
  lastCrawledAt: listingSitesTable.lastCrawledAt,
  lastListingCount: listingSitesTable.lastListingCount,
  createdAt: listingSitesTable.createdAt,
};

export const listingSitesRepository = {
  async findAllForTenant(tenantId: string): Promise<ListingSiteSummary[]> {
    return withTenant(tenantId, (tx) =>
      tx.select(summaryColumns).from(listingSitesTable).where(eq(listingSitesTable.tenantId, tenantId)).orderBy(asc(listingSitesTable.siteName))
    );
  },

  async findByDomain(tenantId: string, domain: string): Promise<ListingSiteSummary | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.select(summaryColumns).from(listingSitesTable).where(and(eq(listingSitesTable.tenantId, tenantId), eq(listingSitesTable.domain, domain)))
    );
    return row;
  },

  async create(tenantId: string, data: { siteName: string; domain: string; siteUrl: string; listingsUrl: string | null; source: ListingSiteOrigin }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(listingSitesTable)
        .values({ ...data, tenantId })
        .onConflictDoNothing({ target: [listingSitesTable.tenantId, listingSitesTable.domain] })
        .returning(summaryColumns)
    );
    return row as ListingSiteSummary | undefined;
  },

  async setActive(tenantId: string, id: string, active: boolean): Promise<ListingSiteSummary | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(listingSitesTable)
        .set({ active, updatedAt: new Date() })
        .where(and(eq(listingSitesTable.tenantId, tenantId), eq(listingSitesTable.id, id)))
        .returning(summaryColumns)
    );
    return row;
  },
};
