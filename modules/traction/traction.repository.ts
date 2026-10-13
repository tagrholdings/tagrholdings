import { withTenant } from "@/lib/db";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  tractionCheckupsTable,
  tractionEntriesTable,
  tractionIssuesTable,
  tractionL10SettingsTable,
  tractionMeasurablesTable,
  tractionMeetingsTable,
  tractionPeopleReviewsTable,
  tractionProcessesTable,
  tractionRocksTable,
  tractionSeatsTable,
  tractionVtoTable,
} from "./traction.schema";
import type {
  CheckupRow,
  EntryRow,
  IssueRow,
  L10Schedule,
  LiveMeeting,
  MeasurableRow,
  MeetingHistoryRow,
  MeetingRow,
  ProcessRow,
  ReviewRow,
  RockRow,
  SeatRow,
} from "./traction.types";

const measurableSelection = {
  id: tractionMeasurablesTable.id,
  name: tractionMeasurablesTable.name,
  ownerPersonId: tractionMeasurablesTable.ownerPersonId,
  cadence: tractionMeasurablesTable.cadence,
  goalOperator: tractionMeasurablesTable.goalOperator,
  goalValue: tractionMeasurablesTable.goalValue,
  goalValueMax: tractionMeasurablesTable.goalValueMax,
  unit: tractionMeasurablesTable.unit,
  aggregation: tractionMeasurablesTable.aggregation,
  sortOrder: tractionMeasurablesTable.sortOrder,
};

const rockSelection = {
  id: tractionRocksTable.id,
  quarter: tractionRocksTable.quarter,
  title: tractionRocksTable.title,
  ownerPersonId: tractionRocksTable.ownerPersonId,
  dueDate: tractionRocksTable.dueDate,
  status: tractionRocksTable.status,
  successCriteria: tractionRocksTable.successCriteria,
  isCompany: tractionRocksTable.isCompany,
  oneYearGoalId: tractionRocksTable.oneYearGoalId,
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
          issueType: tractionIssuesTable.issueType,
          rootCause: tractionIssuesTable.rootCause,
          outcome: tractionIssuesTable.outcome,
          notes: tractionIssuesTable.notes,
          horizon: tractionIssuesTable.horizon,
          status: tractionIssuesTable.status,
          rank: tractionIssuesTable.rank,
          raisedByPersonId: tractionIssuesTable.raisedByPersonId,
          ownerPersonId: tractionIssuesTable.ownerPersonId,
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
        .select({
          id: tractionIssuesTable.id,
          status: tractionIssuesTable.status,
          title: tractionIssuesTable.title,
          issueType: tractionIssuesTable.issueType,
          ownerPersonId: tractionIssuesTable.ownerPersonId,
        })
        .from(tractionIssuesTable)
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
    );
    return row;
  },

  async insertIssue(
    tenantId: string,
    values: {
      title: string;
      issueType: string;
      rootCause: string | null;
      notes: string | null;
      horizon: string;
      ownerPersonId: string | null;
      raisedByPersonId: string | null;
      measurableId: string | null;
      rockId: string | null;
    }
  ) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionIssuesTable).values({ ...values, tenantId }).returning({ id: tractionIssuesTable.id }));
    return row;
  },

  async updateIssue(tenantId: string, id: string, values: { title: string; issueType: string; rootCause: string | null; notes: string | null; horizon: string; ownerPersonId: string | null }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionIssuesTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionIssuesTable.tenantId, tenantId), eq(tractionIssuesTable.id, id)))
        .returning({ id: tractionIssuesTable.id })
    );
    return row;
  },

  /** Closes (or reopens) an issue. `horizon` moves it between lists — an idea decided "later" or an escalated obstacle. */
  async setIssueStatus(
    tenantId: string,
    id: string,
    status: "open" | "solved" | "dropped",
    solution: string | null,
    extra: { outcome?: string | null; horizon?: string } = {}
  ) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionIssuesTable)
        .set({ status, solution, solvedAt: status === "solved" ? new Date() : null, rank: null, outcome: extra.outcome ?? null, ...(extra.horizon ? { horizon: extra.horizon } : {}), updatedAt: new Date() })
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
      tx
        .select(meetingSelection)
        .from(tractionMeetingsTable)
        .where(and(eq(tractionMeetingsTable.tenantId, tenantId), eq(tractionMeetingsTable.status, "concluded")))
        .orderBy(desc(tractionMeetingsTable.heldAt))
        .limit(limit)
    );
  },

  /** Concluded meetings, newest first, with who rated what and the headlines — the L10 history page. */
  async findMeetingHistory(tenantId: string, limit: number): Promise<MeetingHistoryRow[]> {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          ...meetingSelection,
          ratings: tractionMeetingsTable.ratings,
          headlines: tractionMeetingsTable.headlines,
          improvement: tractionMeetingsTable.improvement,
          createdByUserId: tractionMeetingsTable.createdByUserId,
        })
        .from(tractionMeetingsTable)
        .where(and(eq(tractionMeetingsTable.tenantId, tenantId), eq(tractionMeetingsTable.status, "concluded")))
        .orderBy(desc(tractionMeetingsTable.heldAt))
        .limit(limit)
    );
  },

  async findLiveMeeting(tenantId: string): Promise<LiveMeeting | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({ id: tractionMeetingsTable.id, startedAt: tractionMeetingsTable.startedAt, ratings: tractionMeetingsTable.ratings })
        .from(tractionMeetingsTable)
        .where(and(eq(tractionMeetingsTable.tenantId, tenantId), eq(tractionMeetingsTable.status, "in_progress")))
        .orderBy(desc(tractionMeetingsTable.startedAt))
        .limit(1)
    );
    return row;
  },

  async insertLiveMeeting(tenantId: string, userId: string, now: Date) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .insert(tractionMeetingsTable)
        .values({ tenantId, status: "in_progress", startedAt: now, heldAt: now, ratings: {}, createdByUserId: userId })
        .returning({ id: tractionMeetingsTable.id, startedAt: tractionMeetingsTable.startedAt, ratings: tractionMeetingsTable.ratings })
    );
    return row;
  },

  /** Adds one person's rating atomically (jsonb merge), so members rating at the same moment never overwrite each other. */
  async setMeetingRating(tenantId: string, meetingId: string, personId: string, rating: number) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionMeetingsTable)
        .set({ ratings: sql`${tractionMeetingsTable.ratings} || jsonb_build_object(${personId}::text, ${rating}::int)` })
        .where(and(eq(tractionMeetingsTable.tenantId, tenantId), eq(tractionMeetingsTable.id, meetingId), eq(tractionMeetingsTable.status, "in_progress")))
        .returning({ id: tractionMeetingsTable.id, ratings: tractionMeetingsTable.ratings })
    );
    return row;
  },

  async concludeMeeting(tenantId: string, meetingId: string, values: Partial<typeof tractionMeetingsTable.$inferInsert>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionMeetingsTable)
        .set({ ...values, status: "concluded" })
        .where(and(eq(tractionMeetingsTable.tenantId, tenantId), eq(tractionMeetingsTable.id, meetingId), eq(tractionMeetingsTable.status, "in_progress")))
        .returning(meetingSelection)
    );
    return row;
  },

  // ───────────── L10 schedule ─────────────

  async findL10Schedule(tenantId: string): Promise<(L10Schedule & { remindedFor: Date | null }) | undefined> {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({
          weekday: tractionL10SettingsTable.weekday,
          startTime: tractionL10SettingsTable.startTime,
          timezone: tractionL10SettingsTable.timezone,
          remindedFor: tractionL10SettingsTable.remindedFor,
        })
        .from(tractionL10SettingsTable)
        .where(eq(tractionL10SettingsTable.tenantId, tenantId))
    );
    return row;
  },

  async upsertL10Schedule(tenantId: string, values: L10Schedule) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(tractionL10SettingsTable)
        .values({ ...values, tenantId })
        .onConflictDoUpdate({ target: tractionL10SettingsTable.tenantId, set: { ...values, remindedFor: null, updatedAt: new Date() } })
    );
  },

  /** Claims the reminder for one meeting start: true for exactly one caller, so two overlapping sweeps can't both send it. */
  async claimL10Reminder(tenantId: string, meetingAt: Date) {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionL10SettingsTable)
        .set({ remindedFor: meetingAt })
        .where(and(eq(tractionL10SettingsTable.tenantId, tenantId), sql`${tractionL10SettingsTable.remindedFor} is distinct from ${meetingAt}`))
        .returning({ id: tractionL10SettingsTable.id })
    );
    return rows.length > 0;
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

  // ───────────── Seats (Accountability Chart) ─────────────

  async findSeats(tenantId: string): Promise<SeatRow[]> {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          id: tractionSeatsTable.id,
          name: tractionSeatsTable.name,
          responsibilities: tractionSeatsTable.responsibilities,
          parentSeatId: tractionSeatsTable.parentSeatId,
          personId: tractionSeatsTable.personId,
          sortOrder: tractionSeatsTable.sortOrder,
        })
        .from(tractionSeatsTable)
        .where(eq(tractionSeatsTable.tenantId, tenantId))
        .orderBy(asc(tractionSeatsTable.sortOrder), asc(tractionSeatsTable.createdAt))
    );
  },

  async insertSeat(tenantId: string, values: Omit<SeatRow, "id">) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionSeatsTable).values({ ...values, tenantId }).returning({ id: tractionSeatsTable.id }));
    return row;
  },

  async updateSeat(tenantId: string, id: string, values: Partial<Omit<SeatRow, "id">>) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionSeatsTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionSeatsTable.tenantId, tenantId), eq(tractionSeatsTable.id, id)))
        .returning({ id: tractionSeatsTable.id })
    );
    return row;
  },

  /** Deletes a seat; the seats under it move up to its parent, so the chart never loses a branch. */
  async deleteSeat(tenantId: string, id: string, parentSeatId: string | null) {
    return withTenant(tenantId, async (tx) => {
      await tx
        .update(tractionSeatsTable)
        .set({ parentSeatId, updatedAt: new Date() })
        .where(and(eq(tractionSeatsTable.tenantId, tenantId), eq(tractionSeatsTable.parentSeatId, id)));
      const [row] = await tx
        .delete(tractionSeatsTable)
        .where(and(eq(tractionSeatsTable.tenantId, tenantId), eq(tractionSeatsTable.id, id)))
        .returning({ id: tractionSeatsTable.id });
      return row;
    });
  },

  // ───────────── People Analyzer ─────────────

  async findReviews(tenantId: string, quarter: string, personIds: string[] | "all"): Promise<ReviewRow[]> {
    if (personIds !== "all" && personIds.length === 0) return [];
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({
          id: tractionPeopleReviewsTable.id,
          personId: tractionPeopleReviewsTable.personId,
          quarter: tractionPeopleReviewsTable.quarter,
          kind: tractionPeopleReviewsTable.kind,
          reviewerPersonId: tractionPeopleReviewsTable.reviewerPersonId,
          valuesRatings: tractionPeopleReviewsTable.valuesRatings,
          getsIt: tractionPeopleReviewsTable.getsIt,
          wantsIt: tractionPeopleReviewsTable.wantsIt,
          capacity: tractionPeopleReviewsTable.capacity,
          notes: tractionPeopleReviewsTable.notes,
          updatedAt: tractionPeopleReviewsTable.updatedAt,
        })
        .from(tractionPeopleReviewsTable)
        .where(
          and(
            eq(tractionPeopleReviewsTable.tenantId, tenantId),
            eq(tractionPeopleReviewsTable.quarter, quarter),
            personIds === "all" ? undefined : inArray(tractionPeopleReviewsTable.personId, personIds)
          )
        )
    );
    return rows as ReviewRow[];
  },

  async upsertReview(tenantId: string, values: Omit<ReviewRow, "id" | "updatedAt">) {
    await withTenant(tenantId, (tx) =>
      tx
        .insert(tractionPeopleReviewsTable)
        .values({ ...values, tenantId })
        .onConflictDoUpdate({
          target: [tractionPeopleReviewsTable.tenantId, tractionPeopleReviewsTable.personId, tractionPeopleReviewsTable.quarter, tractionPeopleReviewsTable.kind],
          set: { ...values, updatedAt: new Date() },
        })
    );
  },

  // ───────────── Processes ─────────────

  async findProcesses(tenantId: string): Promise<ProcessRow[]> {
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({
          id: tractionProcessesTable.id,
          name: tractionProcessesTable.name,
          area: tractionProcessesTable.area,
          ownerPersonId: tractionProcessesTable.ownerPersonId,
          steps: tractionProcessesTable.steps,
          stage: tractionProcessesTable.stage,
          lastReviewedAt: tractionProcessesTable.lastReviewedAt,
          updatedAt: tractionProcessesTable.updatedAt,
        })
        .from(tractionProcessesTable)
        .where(eq(tractionProcessesTable.tenantId, tenantId))
        .orderBy(asc(tractionProcessesTable.area), asc(tractionProcessesTable.name))
    );
    return rows as ProcessRow[];
  },

  async insertProcess(tenantId: string, values: Omit<ProcessRow, "id" | "updatedAt" | "lastReviewedAt">) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.insert(tractionProcessesTable).values({ ...values, tenantId, lastReviewedAt: new Date() }).returning({ id: tractionProcessesTable.id })
    );
    return row;
  },

  async updateProcess(tenantId: string, id: string, values: Partial<Omit<ProcessRow, "id" | "updatedAt" | "lastReviewedAt">> & { lastReviewedAt?: Date }) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .update(tractionProcessesTable)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(tractionProcessesTable.tenantId, tenantId), eq(tractionProcessesTable.id, id)))
        .returning({ id: tractionProcessesTable.id })
    );
    return row;
  },

  async deleteProcess(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.delete(tractionProcessesTable).where(and(eq(tractionProcessesTable.tenantId, tenantId), eq(tractionProcessesTable.id, id))).returning({ id: tractionProcessesTable.id })
    );
    return row;
  },

  // ───────────── Organizational Checkup ─────────────

  async findCheckups(tenantId: string): Promise<CheckupRow[]> {
    return withTenant(tenantId, (tx) =>
      tx
        .select({ id: tractionCheckupsTable.id, takenAt: tractionCheckupsTable.takenAt, answers: tractionCheckupsTable.answers, score: tractionCheckupsTable.score, notes: tractionCheckupsTable.notes })
        .from(tractionCheckupsTable)
        .where(eq(tractionCheckupsTable.tenantId, tenantId))
        .orderBy(asc(tractionCheckupsTable.takenAt))
    );
  },

  async insertCheckup(tenantId: string, values: { answers: number[]; score: number; notes: string | null; takenByUserId: string }) {
    const [row] = await withTenant(tenantId, (tx) => tx.insert(tractionCheckupsTable).values({ ...values, tenantId }).returning({ id: tractionCheckupsTable.id }));
    return row;
  },

  async deleteCheckup(tenantId: string, id: string) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx.delete(tractionCheckupsTable).where(and(eq(tractionCheckupsTable.tenantId, tenantId), eq(tractionCheckupsTable.id, id))).returning({ id: tractionCheckupsTable.id })
    );
    return row;
  },
};
