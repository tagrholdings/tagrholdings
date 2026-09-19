import { withTenant } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { searchProfilesTable } from "./search-profiles.schema";
import type { SearchProfileSummary } from "./search-profiles.types";

// runState (the job's checkpoint) is never selected: the app treats it as opaque.
const summaryColumns = {
  id: searchProfilesTable.id,
  name: searchProfilesTable.name,
  category: searchProfilesTable.category,
  keywords: searchProfilesTable.keywords,
  city: searchProfilesTable.city,
  state: searchProfilesTable.state,
  radiusMiles: searchProfilesTable.radiusMiles,
  sources: searchProfilesTable.sources,
  maxLeadsPerRun: searchProfilesTable.maxLeadsPerRun,
  frequencyHours: searchProfilesTable.frequencyHours,
  criteria: searchProfilesTable.criteria,
  active: searchProfilesTable.active,
  runRequestedAt: searchProfilesTable.runRequestedAt,
  lastRunAt: searchProfilesTable.lastRunAt,
  createdAt: searchProfilesTable.createdAt,
};

export const searchProfilesRepository = {
  async findAllForTenant(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select(summaryColumns)
        .from(searchProfilesTable)
        .where(eq(searchProfilesTable.tenantId, tenantId))
        .orderBy(desc(searchProfilesTable.createdAt))
    );
  },

  async findById(tenantId: string, id: string): Promise<SearchProfileSummary | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select(summaryColumns)
        .from(searchProfilesTable)
        .where(and(eq(searchProfilesTable.tenantId, tenantId), eq(searchProfilesTable.id, id)))
    );
    return row;
  },

  async create(tenantId: string, data: Omit<typeof searchProfilesTable.$inferInsert, "tenantId">) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(searchProfilesTable)
        .values({ ...data, tenantId })
        .returning(summaryColumns)
    );
    return row;
  },

  async update(tenantId: string, id: string, data: Partial<typeof searchProfilesTable.$inferInsert>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(searchProfilesTable)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(searchProfilesTable.tenantId, tenantId), eq(searchProfilesTable.id, id)))
        .returning(summaryColumns)
    );
    return row;
  },
};
