import { withTenant } from "@/lib/db";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  tractionEntriesTable,
  tractionIssuesTable,
  tractionMeasurablesTable,
  tractionMeetingsTable,
  tractionRocksTable,
  tractionVtoTable,
} from "./traction.schema";
import type { EntryRow, IssueRow, MeasurableRow, MeetingHistoryRow, MeetingRow, RockRow } from "./traction.types";

const measurableSelection = {
  id: tractionMeasurablesTable.id,
  name: tractionMeasurablesTable.name,
  ownerUserId: tractionMeasurablesTable.ownerUserId,
  cadence: tractionMeasurablesTable.cadence,
  goalOperator: tractionMeasurablesTable.goalOperator,
  goalValue: tractionMeasurablesTable.goalValue,
  unit: tractionMeasurablesTable.unit,
  aggregation: tractionMeasurablesTable.aggregation,
  sortOrder: tractionMeasurablesTable.sortOrder,
};

const rockSelection = {
  id: tractionRocksTable.id,
  quarter: tractionRocksTable.quarter,
  title: tractionRocksTable.title,
  ownerUserId: tractionRocksTable.ownerUserId,
  dueDate: tractionRocksTable.dueDate,
  status: tractionRocksTable.status,
  successCriteria: tractionRocksTable.successCriteria,
};

const meetingSelection = {
  id: tractionMeetingsTable.id,
  heldAt: tractionMeetingsTable.heldAt,
  averageRating: tractionMeetingsTable.averageRating,
  todosDone: tractionMeetingsTable.todosDone,
  todosTotal: tractionMeetingsTable.todosTotal,
  issuesSolved: tractionMeetingsTable.issuesSolved,
  rocksOffTrack: tractionMeetingsTable.rocksOffTrack,
  measurablesOffGoal: tractionMeetingsTable.measurablesOffGoal,
};


/** Pure queries — every one filtered by tenant_id AND run inside withTenant (RLS). No rules here; see the Service. */
export const tractionRepository = {
  // ───────────── Scorecard ─────────────

  async findMeasurables(tenantId: string): Promise<MeasurableRow[]> {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select(measurableSelection)
        .from(tractionMeasurablesTable)
        .where(and(eq(tractionMeasurablesTable.tenantId, tenantId), isNull(tractionMeasurablesTable.archivedAt)))
        .orderBy(asc(tractionMeasurablesTable.sortOrder), asc(tractionMeasurablesTable.createdAt))
    );
    return rows as MeasurableRow[];
  },

  async findMeasurable(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select(measurableSelection)
        .from(tractionMeasurablesTable)
        .where(and(eq(tractionMeasurablesTable.tenantId, tenantId), eq(tractionMeasurablesTable.id, id), isNull(tractionMeasurablesTable.archivedAt)))
    );
    return row as MeasurableRow | undefined;
  },

  async nextMeasurableSortOrder(tenantId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ max: sql<number | null>`max(${tractionMeasurablesTable.sortOrder})` })
        .from(tractionMeasurablesTable)
        .where(eq(tractionMeasurablesTable.tenantId, tenantId))
    );
    return (row?.max ?? -1) + 1;
  },

  async insertMeasurable(tenantId: string, values: Omit<MeasurableRow, "id">) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionMeasurablesTable).values({ ...values, tenantId }).returning({ id: tractionMeasurablesTable.id }));
    return row;
  },

  async updateMeasurable(tenantId: string, id: string, values: Omit<MeasurableRow, "id" | "sortOrder">) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionMeasurablesTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionMeasurablesTable.tenantId, tenantId), eq(tractionMeasurablesTable.id, id)))
        .returning({ id: tractionMeasurablesTable.id })
    );
    return row;
  },

  async archiveMeasurable(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionMeasurablesTable)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tractionMeasurablesTable.tenantId, tenantId), eq(tractionMeasurablesTable.id, id)))
        .returning({ id: tractionMeasurablesTable.id })
    );
    return row;
  },

  /** Entries of the given measurables between two period starts (inclusive). */
  async findEntries(tenantId: string, measurableIds: string[], from: string, to: string): Promise<EntryRow[]> {
    if (measurableIds.length === 0) return [];
    return withTenant(tenantId, (tx) =>
      tx
        .select({ measurableId: tractionEntriesTable.measurableId, periodStart: tractionEntriesTable.periodStart, value: tractionEntriesTable.value })
        .from(tractionEntriesTable)
        .where(
          and(
            eq(tractionEntriesTable.tenantId, tenantId),
            inArray(tractionEntriesTable.measurableId, measurableIds),
            gte(tractionEntriesTable.periodStart, from),
            lte(tractionEntriesTable.periodStart, to)
          )
        )
    );
  },

  /** Each measurable's most recent entry — what the Overview and the L10 read as "the current number". */
  async findLatestEntries(tenantId: string): Promise<EntryRow[]> {
    return withTenant(tenantId, (tx) =>
      tx
        .selectDistinctOn([tractionEntriesTable.measurableId], {
          measurableId: tractionEntriesTable.measurableId,
          periodStart: tractionEntriesTable.periodStart,
          value: tractionEntriesTable.value,
        })
        .from(tractionEntriesTable)
        .where(eq(tractionEntriesTable.tenantId, tenantId))
        .orderBy(tractionEntriesTable.measurableId, desc(tractionEntriesTable.periodStart))
    );
  },

  async upsertEntry(tenantId: string, measurableId: string, periodStart: string, value: number, userId: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(tractionEntriesTable)
        .values({ tenantId, measurableId, periodStart, value, updatedByUserId: userId })
        .onConflictDoUpdate({
          target: [tractionEntriesTable.measurableId, tractionEntriesTable.periodStart],
          set: { value, updatedByUserId: userId, updatedAt: new Date() },
          where: eq(tractionEntriesTable.tenantId, tenantId),
        })
    );
  },

  async deleteEntry(tenantId: string, measurableId: string, periodStart: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .delete(tractionEntriesTable)
        .where(
          and(
            eq(tractionEntriesTable.tenantId, tenantId),
            eq(tractionEntriesTable.measurableId, measurableId),
            eq(tractionEntriesTable.periodStart, periodStart)
          )
        )
    );
  },

  // ───────────── Rocks ─────────────

  async findRocks(tenantId: string): Promise<RockRow[]> {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select(rockSelection)
        .from(tractionRocksTable)
        .where(eq(tractionRocksTable.tenantId, tenantId))
        .orderBy(desc(tractionRocksTable.quarter), asc(tractionRocksTable.createdAt))
    );
    return rows as RockRow[];
  },

  async findRock(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.select(rockSelection).from(tractionRocksTable).where(and(eq(tractionRocksTable.tenantId, tenantId), eq(tractionRocksTable.id, id)))
    );
    return row as RockRow | undefined;
  },

  async insertRock(tenantId: string, values: Omit<RockRow, "id">) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionRocksTable).values({ ...values, tenantId }).returning({ id: tractionRocksTable.id }));
    return row;
  },

  async updateRock(tenantId: string, id: string, values: Partial<Omit<RockRow, "id">>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionRocksTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionRocksTable.tenantId, tenantId), eq(tractionRocksTable.id, id)))
        .returning({ id: tractionRocksTable.id })
    );
    return row;
  },

  /** Deletes a Rock; issues that came from it keep existing, just unlinked. */
  async deleteRock(tenantId: string, id: string) {
    return withTenant(tenantId, async (tx) => {
      await tx
        .update(tractionIssuesTable)
        .set({ rockId: null, updatedAt: new Date() })
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.rockId, id)));
      const [row] = await tx
        .delete(tractionRocksTable)
        .where(and(eq(tractionRocksTable.tenantId, tenantId), eq(tractionRocksTable.id, id)))
        .returning({ id: tractionRocksTable.id });
      return row;
    });
  },

  // ───────────── Issues ─────────────

  /** Open issues (every horizon) plus the ones solved or dropped since `closedSince`. */
  async findIssues(tenantId: string, closedSince: Date): Promise<IssueRow[]> {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({
          id: tractionIssuesTable.id,
          title: tractionIssuesTable.title,
          notes: tractionIssuesTable.notes,
          horizon: tractionIssuesTable.horizon,
          status: tractionIssuesTable.status,
          rank: tractionIssuesTable.rank,
          raisedByUserId: tractionIssuesTable.raisedByUserId,
          ownerUserId: tractionIssuesTable.ownerUserId,
          measurableId: tractionIssuesTable.measurableId,
          measurableName: tractionMeasurablesTable.name,
          rockId: tractionIssuesTable.rockId,
          rockTitle: tractionRocksTable.title,
          solution: tractionIssuesTable.solution,
          solvedAt: tractionIssuesTable.solvedAt,
          createdAt: tractionIssuesTable.createdAt,
        })
        .from(tractionIssuesTable)
        .leftJoin(tractionMeasurablesTable, eq(tractionIssuesTable.measurableId, tractionMeasurablesTable.id))
        .leftJoin(tractionRocksTable, eq(tractionIssuesTable.rockId, tractionRocksTable.id))
        .where(
          and(
            eq(tractionIssuesTable.tenantId, tenantId),
            or(eq(tractionIssuesTable.status, "open"), gte(tractionIssuesTable.updatedAt, closedSince))
          )
        )
        .orderBy(sql`${tractionIssuesTable.rank} asc nulls last`, asc(tractionIssuesTable.createdAt))
    );
    return rows as IssueRow[];
  },

  async findIssue(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: tractionIssuesTable.id, status: tractionIssuesTable.status, title: tractionIssuesTable.title, ownerUserId: tractionIssuesTable.ownerUserId })
        .from(tractionIssuesTable)
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
    );
    return row;
  },

  async insertIssue(
    tenantId: string,
    values: { title: string; notes: string | null; horizon: string; ownerUserId: string | null; raisedByUserId: string | null; measurableId: string | null; rockId: string | null }
  ) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionIssuesTable).values({ ...values, tenantId }).returning({ id: tractionIssuesTable.id }));
    return row;
  },

  async updateIssue(tenantId: string, id: string, values: { title: string; notes: string | null; horizon: string; ownerUserId: string | null }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionIssuesTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
        .returning({ id: tractionIssuesTable.id })
    );
    return row;
  },

  async setIssueStatus(tenantId: string, id: string, status: "open" | "solved" | "dropped", solution: string | null) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionIssuesTable)
        .set({ status, solution, solvedAt: status === "solved" ? new Date() : null, rank: null, updatedAt: new Date() })
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
        .returning({ id: tractionIssuesTable.id })
    );
    return row;
  },

  /** Ranks the given open issues 1..n in order. */
  async setIssueRanks(tenantId: string, ids: string[]) {
    await withTenant(tenantId, async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(tractionIssuesTable)
          .set({ rank: index + 1 })
          .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id), eq(tractionIssuesTable.status, "open")));
      }
    });
  },

  async deleteIssue(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .delete(tractionIssuesTable)
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
        .returning({ id: tractionIssuesTable.id })
    );
    return row;
  },

  // ───────────── Meetings ─────────────

  async findMeetings(tenantId: string, limit: number): Promise<MeetingRow[]> {
    return withTenant(tenantId, (tx) =>
      tx.select(meetingSelection).from(tractionMeetingsTable).where(eq(tractionMeetingsTable.tenantId, tenantId)).orderBy(desc(tractionMeetingsTable.heldAt)).limit(limit)
    );
  },

  /** Concluded meetings, newest first, with who rated what and the headlines — the L10 history page. */
  async findMeetingHistory(tenantId: string, limit: number): Promise<MeetingHistoryRow[]> {
    return withTenant(tenantId, (tx) =>
      tx
        .select({ ...meetingSelection, ratings: tractionMeetingsTable.ratings, headlines: tractionMeetingsTable.headlines, createdByUserId: tractionMeetingsTable.createdByUserId })
        .from(tractionMeetingsTable)
        .where(eq(tractionMeetingsTable.tenantId, tenantId))
        .orderBy(desc(tractionMeetingsTable.heldAt))
        .limit(limit)
    );
  },

  async insertMeeting(tenantId: string, values: Omit<typeof tractionMeetingsTable.$inferInsert, "tenantId" | "id">) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionMeetingsTable).values({ ...values, tenantId }).returning(meetingSelection));
    return row;
  },

  // ───────────── V/TO ─────────────

  async findVto(tenantId: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ content: tractionVtoTable.content, updatedAt: tractionVtoTable.updatedAt, updatedByUserId: tractionVtoTable.updatedByUserId })
        .from(tractionVtoTable)
        .where(eq(tractionVtoTable.tenantId, tenantId))
    );
    return row;
  },

  async upsertVto(tenantId: string, content: Record<string, unknown>, userId: string) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(tractionVtoTable)
        .values({ tenantId, content, updatedByUserId: userId })
        .onConflictDoUpdate({ target: tractionVtoTable.tenantId, set: { content, updatedByUserId: userId, updatedAt: new Date() } })
    );
  },
};
