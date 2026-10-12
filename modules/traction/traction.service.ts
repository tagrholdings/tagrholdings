import { UserFacingError } from "@/lib/errors";
import { activitiesService } from "@/modules/activities/activities.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { tractionRepository } from "./traction.repository";
import {
  goalMet,
  latestEntry,
  periodStartFor,
  periodWindow,
  quarterOf,
  quarterRange,
  shiftPeriod,
  todayIso,
  type Cadence,
} from "./traction.logic";
import {
  vtoContentSchema,
  type ConcludeMeetingInput,
  type EntryInput,
  type IssueUpdate,
  type MeasurableRow,
  type MeasurableUpdate,
  type NewIssue,
  type NewMeasurable,
  type NewRock,
  type NewTodo,
  type RockRow,
  type RockStatus,
  type RockUpdate,
  type SolveIssueInput,
  type TractionSummary,
  type VtoContent,
} from "./traction.types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A finished To-Do or a closed issue stays visible this long — "this week" in the L10. */
const RECENT_MS = 7 * DAY_MS;

/** An owner must be a member of the workspace — the id is a Neon Auth user id with no FK possible. */
async function assertMember(tenantId: string, userId: string | null | undefined) {
  if (userId && !(await tenancyService.isMember(tenantId, userId))) {
    throw new UserFacingError("That person isn't a member of this workspace.");
  }
}

function measurableValues(data: NewMeasurable): Omit<MeasurableRow, "id" | "sortOrder"> {
  return {
    name: data.name.trim(),
    ownerUserId: data.ownerUserId ?? null,
    cadence: data.cadence,
    unit: data.unit,
    aggregation: data.aggregation,
    goalOperator: data.goalOperator ?? null,
    goalValue: data.goalValue ?? null,
  };
}

/** The quarter the Rocks page and the Overview open on: this quarter if it has Rocks, else the latest one that does. */
function focusQuarter(rocks: RockRow[], today: string): string {
  const current = quarterOf(today);
  if (rocks.some((r) => r.quarter === current)) return current;
  const past = rocks.map((r) => r.quarter).filter((q) => q <= current).sort();
  return past.at(-1) ?? current;
}

export const tractionService = {
  // ───────────── Scorecard ─────────────

  /**
   * Measurables of one cadence and their values over the visible window of periods (the last 13 weeks or 6 months,
   * ending `windowEnd` — today by default; earlier when the person pages back).
   */
  async getScorecard(tenantId: string, cadence: Cadence, windowEnd: string = todayIso()) {
    const all = await tractionRepository.findMeasurables(tenantId);
    const measurables = all.filter((m) => m.cadence === cadence);
    const periods = periodWindow(windowEnd, cadence);
    // The Quarter column needs every period of the last column's quarter, which may start before the window does.
    const from = [periods[0], periodStartFor(quarterRange(quarterOf(periods.at(-1)!)).start, cadence)].sort()[0];
    const entries = await tractionRepository.findEntries(tenantId, measurables.map((m) => m.id), from, periods.at(-1)!);
    return { measurables, entries, periods, counts: { weekly: all.filter((m) => m.cadence === "weekly").length, monthly: all.filter((m) => m.cadence === "monthly").length } };
  },

  async createMeasurable(tenantId: string, data: NewMeasurable) {
    await assertMember(tenantId, data.ownerUserId);
    const sortOrder = await tractionRepository.nextMeasurableSortOrder(tenantId);
    return tractionRepository.insertMeasurable(tenantId, { ...measurableValues(data), sortOrder });
  },

  async updateMeasurable(tenantId: string, data: MeasurableUpdate) {
    await assertMember(tenantId, data.ownerUserId);
    const updated = await tractionRepository.updateMeasurable(tenantId, data.id, measurableValues(data));
    if (!updated) throw new UserFacingError("Measurable not found.");
    return updated;
  },

  /** Archived, never deleted: its history and any issue dropped from it stay. */
  async archiveMeasurable(tenantId: string, id: string) {
    const archived = await tractionRepository.archiveMeasurable(tenantId, id);
    if (!archived) throw new UserFacingError("Measurable not found.");
  },

  /** Writes one cell. The period is normalised to its week/month start, so a cell can never land between columns. */
  async setEntry(tenantId: string, input: EntryInput, userId: string) {
    const measurable = await tractionRepository.findMeasurable(tenantId, input.measurableId);
    if (!measurable) throw new UserFacingError("Measurable not found.");
    const periodStart = periodStartFor(input.periodStart, measurable.cadence);
    if (input.value === null) await tractionRepository.deleteEntry(tenantId, measurable.id, periodStart);
    else await tractionRepository.upsertEntry(tenantId, measurable.id, periodStart, input.value, userId);
  },

  // ───────────── Rocks ─────────────

  async getRocks(tenantId: string) {
    const rocks = await tractionRepository.findRocks(tenantId);
    return { rocks, focusQuarter: focusQuarter(rocks, todayIso()), currentQuarter: quarterOf(todayIso()) };
  },

  async createRock(tenantId: string, data: NewRock) {
    await assertMember(tenantId, data.ownerUserId);
    return tractionRepository.insertRock(tenantId, {
      title: data.title.trim(),
      quarter: data.quarter,
      ownerUserId: data.ownerUserId ?? null,
      dueDate: data.dueDate ?? null,
      successCriteria: data.successCriteria?.trim() || null,
      status: data.status,
    });
  },

  async updateRock(tenantId: string, data: RockUpdate) {
    await assertMember(tenantId, data.ownerUserId);
    const updated = await tractionRepository.updateRock(tenantId, data.id, {
      title: data.title.trim(),
      quarter: data.quarter,
      ownerUserId: data.ownerUserId ?? null,
      dueDate: data.dueDate ?? null,
      successCriteria: data.successCriteria?.trim() || null,
      status: data.status,
    });
    if (!updated) throw new UserFacingError("Rock not found.");
    return updated;
  },

  async setRockStatus(tenantId: string, id: string, status: RockStatus) {
    const updated = await tractionRepository.updateRock(tenantId, id, { status });
    if (!updated) throw new UserFacingError("Rock not found.");
  },

  async deleteRock(tenantId: string, id: string) {
    const deleted = await tractionRepository.deleteRock(tenantId, id);
    if (!deleted) throw new UserFacingError("Rock not found.");
  },

  // ───────────── Issues ─────────────

  async getIssues(tenantId: string, now: Date = new Date()) {
    return tractionRepository.findIssues(tenantId, new Date(now.getTime() - RECENT_MS));
  },

  async createIssue(tenantId: string, data: NewIssue, raisedByUserId: string) {
    await assertMember(tenantId, data.ownerUserId);
    // A measurable/rock link from another workspace is rejected by the composite foreign keys.
    return tractionRepository.insertIssue(tenantId, {
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
      horizon: data.horizon,
      ownerUserId: data.ownerUserId ?? null,
      raisedByUserId,
      measurableId: data.measurableId ?? null,
      rockId: data.rockId ?? null,
    });
  },

  async updateIssue(tenantId: string, data: IssueUpdate) {
    await assertMember(tenantId, data.ownerUserId);
    const updated = await tractionRepository.updateIssue(tenantId, data.id, {
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
      horizon: data.horizon,
      ownerUserId: data.ownerUserId ?? null,
    });
    if (!updated) throw new UserFacingError("Issue not found.");
  },

  /** Solve: closes the issue and, usually, creates the L10 To-Do that carries the solution out (linked to the issue). */
  async solveIssue(tenantId: string, input: SolveIssueInput, userId: string) {
    const issue = await tractionRepository.findIssue(tenantId, input.id);
    if (!issue) throw new UserFacingError("Issue not found.");
    if (issue.status !== "open") throw new UserFacingError("That issue is already closed.");
    await assertMember(tenantId, input.todo?.assignedToUserId);
    await tractionRepository.setIssueStatus(tenantId, input.id, "solved", input.solution?.trim() || null);
    if (input.todo) {
      await activitiesService.create(
        tenantId,
        { type: "task", subject: input.todo.subject.trim(), dueDate: input.todo.dueDate ?? null, assignedToUserId: input.todo.assignedToUserId ?? null },
        userId,
        { l10Todo: true, issueId: input.id }
      );
    }
  },

  async dropIssue(tenantId: string, id: string) {
    const issue = await tractionRepository.findIssue(tenantId, id);
    if (!issue) throw new UserFacingError("Issue not found.");
    await tractionRepository.setIssueStatus(tenantId, id, "dropped", null);
  },

  async reopenIssue(tenantId: string, id: string) {
    const issue = await tractionRepository.findIssue(tenantId, id);
    if (!issue) throw new UserFacingError("Issue not found.");
    await tractionRepository.setIssueStatus(tenantId, id, "open", null);
  },

  async reorderIssues(tenantId: string, ids: string[]) {
    await tractionRepository.setIssueRanks(tenantId, [...new Set(ids)]);
  },

  async deleteIssue(tenantId: string, id: string) {
    await activitiesService.unlinkIssue(tenantId, id);
    const deleted = await tractionRepository.deleteIssue(tenantId, id);
    if (!deleted) throw new UserFacingError("Issue not found.");
  },

  // ───────────── L10 ─────────────

  async getTodos(tenantId: string, now: Date = new Date()) {
    return activitiesService.listL10Todos(tenantId, new Date(now.getTime() - RECENT_MS));
  },

  async createTodo(tenantId: string, data: NewTodo, userId: string) {
    return activitiesService.create(
      tenantId,
      { type: "task", subject: data.subject.trim(), dueDate: data.dueDate ?? null, assignedToUserId: data.assignedToUserId ?? null },
      userId,
      { l10Todo: true }
    );
  },

  /** Everything the L10 walks through, in agenda order. */
  async getMeetingData(tenantId: string) {
    const [measurables, latest, rocksData, issues, todos, meetings] = await Promise.all([
      tractionRepository.findMeasurables(tenantId),
      tractionRepository.findLatestEntries(tenantId),
      this.getRocks(tenantId),
      this.getIssues(tenantId),
      this.getTodos(tenantId),
      tractionRepository.findMeetings(tenantId, 5),
    ]);
    return {
      measurables,
      latest,
      rocks: rocksData.rocks.filter((r) => r.quarter === rocksData.focusQuarter),
      quarter: rocksData.focusQuarter,
      issues: issues.filter((i) => i.horizon === "short_term"),
      todos,
      meetings,
    };
  },

  /**
   * Conclude: records the meeting with a snapshot of where things stood (ratings, To-Do completion, issues solved
   * this week, Rocks off track, measurables off goal). Ratings may only come from workspace members.
   */
  async concludeMeeting(tenantId: string, input: ConcludeMeetingInput, userId: string, now: Date = new Date()) {
    const raters = Object.keys(input.ratings);
    for (const rater of raters) await assertMember(tenantId, rater);
    const [summary, issues] = await Promise.all([this.getSummary(tenantId, now), this.getIssues(tenantId, now)]);
    const values = Object.values(input.ratings);
    return tractionRepository.insertMeeting(tenantId, {
      heldAt: now,
      ratings: input.ratings,
      averageRating: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
      todosDone: summary.todos.done,
      todosTotal: summary.todos.total,
      issuesSolved: issues.filter((i) => i.status === "solved").length,
      rocksOffTrack: summary.rocks.offTrack,
      measurablesOffGoal: summary.scorecard.offGoal,
      headlines: input.headlines?.trim() || null,
      createdByUserId: userId,
    });
  },

  async getMeetings(tenantId: string, limit = 10) {
    return tractionRepository.findMeetings(tenantId, limit);
  },

  /** The last year of weekly L10s (52), newest first. */
  async getMeetingHistory(tenantId: string, limit = 52) {
    return tractionRepository.findMeetingHistory(tenantId, limit);
  },

  // ───────────── V/TO ─────────────

  /** Always a complete document — missing sections come back empty, so the page never has to guess. */
  async getVto(tenantId: string): Promise<{ content: VtoContent; updatedAt: Date | null; updatedByUserId: string | null }> {
    const row = await tractionRepository.findVto(tenantId);
    const parsed = vtoContentSchema.safeParse(row?.content ?? {});
    return { content: parsed.success ? parsed.data : vtoContentSchema.parse({}), updatedAt: row?.updatedAt ?? null, updatedByUserId: row?.updatedByUserId ?? null };
  },

  async saveVto(tenantId: string, content: VtoContent, userId: string) {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    await tractionRepository.upsertVto(
      tenantId,
      {
        ...content,
        coreValues: clean(content.coreValues),
        marketing: { ...content.marketing, uniques: clean(content.marketing.uniques) },
        threeYear: { ...content.threeYear, picture: clean(content.threeYear.picture) },
        oneYear: { ...content.oneYear, goals: clean(content.oneYear.goals) },
      },
      userId
    );
  },

  // ───────────── Overview / Portfolio ─────────────

  /** One workspace's state at a glance — the Overview tiles, the L10 snapshot and one Portfolio row. */
  async getSummary(tenantId: string, now: Date = new Date()): Promise<TractionSummary> {
    const [measurables, latest, rocks, issues, todos, meetings] = await Promise.all([
      tractionRepository.findMeasurables(tenantId),
      tractionRepository.findLatestEntries(tenantId),
      tractionRepository.findRocks(tenantId),
      this.getIssues(tenantId, now),
      this.getTodos(tenantId, now),
      tractionRepository.findMeetings(tenantId, 1),
    ]);
    const today = todayIso(now);
    let onGoal = 0;
    let offGoal = 0;
    let notEntered = 0;
    for (const m of measurables) {
      const entry = latestEntry(latest.filter((e) => e.measurableId === m.id));
      // A number older than the previous period is stale: it counts as not entered, not as green.
      const stale = !entry || entry.periodStart < shiftPeriod(periodStartFor(today, m.cadence), m.cadence, -1);
      if (stale) notEntered++;
      const met = entry && !stale ? goalMet(m, entry.value) : null;
      if (met === true) onGoal++;
      if (met === false) offGoal++;
    }
    const quarter = focusQuarter(rocks, today);
    const quarterRocks = rocks.filter((r) => r.quarter === quarter && r.status !== "dropped");
    return {
      scorecard: { onGoal, offGoal, notEntered, total: measurables.length },
      rocks: {
        quarter,
        total: quarterRocks.length,
        complete: quarterRocks.filter((r) => r.status === "complete").length,
        onTrack: quarterRocks.filter((r) => r.status === "on_track").length,
        offTrack: quarterRocks.filter((r) => r.status === "off_track").length,
      },
      openIssues: issues.filter((i) => i.status === "open" && i.horizon === "short_term").length,
      todos: { done: todos.filter((t) => t.done).length, total: todos.length },
      lastMeeting: meetings[0] ?? null,
    };
  },

  /**
   * The super admin's Portfolio: one summary per active workspace. Each one is read through its own `withTenant`
   * (inside getSummary) — never one query across tenants, so RLS still holds every row to its workspace.
   */
  async getPortfolio(now: Date = new Date()) {
    const tenants = await tenancyService.listTenants();
    return Promise.all(tenants.map(async (t) => ({ tenantId: t.id, slug: t.slug, name: t.name, summary: await this.getSummary(t.id, now) })));
  },
};
