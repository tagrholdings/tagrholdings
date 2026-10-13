import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioScorecardTemplateTable } from "./portfolio.schema";
import type { TemplateRow } from "./portfolio.types";

const selection = {
  id: portfolioScorecardTemplateTable.id,
  name: portfolioScorecardTemplateTable.name,
  cadence: portfolioScorecardTemplateTable.cadence,
  unit: portfolioScorecardTemplateTable.unit,
  aggregation: portfolioScorecardTemplateTable.aggregation,
  goalOperator: portfolioScorecardTemplateTable.goalOperator,
  goalValue: portfolioScorecardTemplateTable.goalValue,
  goalValueMax: portfolioScorecardTemplateTable.goalValueMax,
  sortOrder: portfolioScorecardTemplateTable.sortOrder,
};

/**
 * The portfolio template has no tenant_id (it belongs to the platform, like platform_roles), so it is read with the
 * plain `db` — the one exception eslint allows in this module. Never put workspace data here.
 */
export const portfolioRepository = {
  async findTemplate(): Promise<TemplateRow[]> {
    const rows = await db.select(selection).from(portfolioScorecardTemplateTable).orderBy(asc(portfolioScorecardTemplateTable.sortOrder), asc(portfolioScorecardTemplateTable.createdAt));
    return rows as TemplateRow[];
  },

  async insert(values: Omit<TemplateRow, "id" | "sortOrder">) {
    const [max] = await db.select({ max: sql<number | null>`max(${portfolioScorecardTemplateTable.sortOrder})` }).from(portfolioScorecardTemplateTable);
    const [row] = await db
      .insert(portfolioScorecardTemplateTable)
      .values({ ...values, sortOrder: (max?.max ?? -1) + 1 })
      .onConflictDoNothing({ target: portfolioScorecardTemplateTable.name })
      .returning({ id: portfolioScorecardTemplateTable.id });
    return row;
  },

  async update(id: string, values: Omit<TemplateRow, "id" | "sortOrder">) {
    const [row] = await db.update(portfolioScorecardTemplateTable).set(values).where(eq(portfolioScorecardTemplateTable.id, id)).returning({ id: portfolioScorecardTemplateTable.id });
    return row;
  },

  async delete(id: string) {
    const [row] = await db.delete(portfolioScorecardTemplateTable).where(eq(portfolioScorecardTemplateTable.id, id)).returning({ id: portfolioScorecardTemplateTable.id });
    return row;
  },
};
