import { randomUUID } from "node:crypto";
import { UserFacingError } from "@/lib/errors";
import { activitiesService } from "@/modules/activities/activities.service";
import { teamService } from "@/modules/team/team.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";
import { tractionRepository } from "./traction.repository";
import {
  checkupScore,
  eosRuleChecks,
  goalMet,
  latestEntry,
  nextMeetingAt,
  percent,
  periodStartFor,
  periodWindow,
  quarterOf,
  quarterRange,
  shiftPeriod,
  shiftQuarter,
  todayIso,
  type Cadence,
} from "./traction.logic";
import {
  OUTCOMES_BY_TYPE,
  vtoContentSchema,
  type ConcludeMeetingInput,
  type EntryInput,
  type IssueOutcome,
  type IssueType,
  type IssueUpdate,
  type L10ScheduleInput,
  type MeasurableRow,
  type MeasurableUpdate,
  type NewIssue,
  type NewMeasurable,
  type NewProcess,
  type NewRock,
  type NewSeat,
  type NewTodo,
  type ProcessUpdate,
  type ResolveIssueInput,
  type ReviewInput,
  type RockActivity,
  type RockRow,
  type RockStatus,
  type RockUpdate,
  type SeatRow,
  type SeatUpdate,
  type StandardMeasurable,
  type TractionSummary,
  type VtoContent,
} from "./traction.types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A finished To-Do or a closed issue stays visible this long — "this week" in the L10. */
const RECENT_MS = 7 * DAY_MS;
/** The L10 reminder goes out this long before the meeting. */
const REMINDER_LEAD_MINUTES = 60;

/** Every owner is a team person (modules/team) — active, and of this workspace. */
const assertPerson = (tenantId: string, personId: string | null | undefined) => teamService.assertActivePerson(tenantId, personId);

function measurableValues(data: NewMeasurable): Omit<MeasurableRow, "id" | "sortOrder"> {
  const between = data.goalOperator === "between";
  return {
    name: data.name.trim(),
    ownerPersonId: data.ownerPersonId,
    cadence: data.cadence,
    unit: data.unit,
    aggregation: data.aggregation,
    goalOperator: data.goalOperator ?? null,
    goalValue: data.goalValue ?? null,
    goalValueMax: between ? (data.goalValueMax ?? null) : null,
  };
}

function rockValues(data: NewRock) {
  return {
    title: data.title.trim(),
    quarter: data.quarter,
    ownerPersonId: data.ownerPersonId,
    dueDate: data.dueDate ?? null,
    successCriteria: data.successCriteria.trim(),
    status: data.status,
    isCompany: data.isCompany,
    oneYearGoalId: data.oneYearGoalId || null,
  };
}

/** The quarter the Rocks page and the Overview open on: this quarter if it has Rocks, else the latest one that does. */
function focusQuarter(rocks: RockRow[], today: string): string {
  const current = quarterOf(today);
  if (rocks.some((r) => r.quarter === current)) return current;
  const past = rocks.map((r) => r.quarter).filter((q) => q <= current).sort();
  return past.at(-1) ?? current;
}

/** EOS scores Rocks binary: the share that were completed (rolled over and dropped count as not done). Null with none. */
export function rockCompletionRate(rocks: RockRow[], quarter: string): number | null {
  const inQuarter = rocks.filter((r) => r.quarter === quarter);
  return inQuarter.length ? percent(inQuarter.filter((r) => r.status === "complete").length, inQuarter.length) : null;
}

/** How an outcome changes an issue: closed (solved/dropped), or kept open on the long-term list. */
function outcomeEffect(outcome: IssueOutcome): { status: "solved" | "dropped" | "open"; horizon?: "long_term"; allowsTodos: boolean } {
  if (outcome === "no") return { status: "dropped", allowsTodos: false };
  if (outcome === "later" || outcome === "escalated") return { status: "open", horizon: "long_term", allowsTodos: false };
  return { status: "solved", allowsTodos: true };
}

/** The seats a person's seat(s) sit directly above — their direct reports in the Accountability Chart. */
function directReports(seats: SeatRow[], personId: string): string[] {
  const mySeats = new Set(seats.filter((s) => s.personId === personId).map((s) => s.id));
  return [...new Set(seats.filter((s) => s.parentSeatId && mySeats.has(s.parentSeatId) && s.personId).map((s) => s.personId!))];
}

export const tractionService = {
  /** The team as owner pickers show it on Traction/EOS pages: each active person with their seat(s). */
  async listOwners(tenantId: string) {
    const [people, seats] = await Promise.all([teamService.listPeople(tenantId), tractionRepository.findSeats(tenantId)]);
    return people
      .filter((p) => !p.archivedAt)
      .map((p) => ({ id: p.id, name: p.name, email: p.email ?? "", seat: seats.filter((s) => s.personId === p.id).map((s) => s.name).join(", ") || null }));
  },

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

  /** The cadence the Scorecard opens on: weekly (the EOS default) unless the workspace only has monthly numbers. */
  async defaultCadence(tenantId: string): Promise<Cadence> {
    const all = await tractionRepository.findMeasurables(tenantId);
    return all.length > 0 && all.every((m) => m.cadence === "monthly") ? "monthly" : "weekly";
  },

  async createMeasurable(tenantId: string, data: NewMeasurable) {
    await assertPerson(tenantId, data.ownerPersonId);
    const sortOrder = await tractionRepository.nextMeasurableSortOrder(tenantId);
    return tractionRepository.insertMeasurable(tenantId, { ...measurableValues(data), sortOrder });
  },

  async updateMeasurable(tenantId: string, data: MeasurableUpdate) {
    await assertPerson(tenantId, data.ownerPersonId);
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

  /** Every Rock's milestones / to-dos (activities linked to a Rock), oldest due first. */
  async getRockActivities(tenantId: string): Promise<RockActivity[]> {
    const activities = await activitiesService.listForTenant(tenantId);
    return activities.flatMap((a) => (a.rockId ? [{ id: a.id, rockId: a.rockId, subject: a.subject, done: a.done, dueDate: a.dueDate }] : []));
  },

  /** Rocks an activity can still be linked to: the open ones (on or off track), any quarter. */
  async listOpenRocks(tenantId: string) {
    const rocks = await tractionRepository.findRocks(tenantId);
    return rocks
      .filter((r) => r.status === "on_track" || r.status === "off_track")
      .map((r) => ({ id: r.id, title: r.title, quarter: r.quarter }));
  },

  async createRock(tenantId: string, data: NewRock) {
    await assertPerson(tenantId, data.ownerPersonId);
    return tractionRepository.insertRock(tenantId, rockValues(data));
  },

  async updateRock(tenantId: string, data: RockUpdate) {
    await assertPerson(tenantId, data.ownerPersonId);
    const existing = await tractionRepository.findRock(tenantId, data.id);
    if (!existing) throw new UserFacingError("Rock not found.");
    // A rolled-over Rock is history: its copy in the next quarter is the one to edit.
    if (existing.status === "rolled_over") throw new UserFacingError("This Rock was carried into the next quarter. Edit it there.");
    return tractionRepository.updateRock(tenantId, data.id, rockValues(data));
  },

  async setRockStatus(tenantId: string, id: string, status: RockStatus) {
    const existing = await tractionRepository.findRock(tenantId, id);
    if (!existing) throw new UserFacingError("Rock not found.");
    if (existing.status === "rolled_over") throw new UserFacingError("This Rock was carried into the next quarter. Update it there.");
    await tractionRepository.updateRock(tenantId, id, { status });
  },

  /**
   * Quarter end for an unfinished Rock (EOS: done is binary — not done is carried forward or dropped). "carry" makes
   * a fresh copy in the next quarter, due on its last day, and marks this one rolled over so history stays honest.
   */
  async closeOutRock(tenantId: string, id: string, action: "complete" | "carry" | "drop") {
    const rock = await tractionRepository.findRock(tenantId, id);
    if (!rock) throw new UserFacingError("Rock not found.");
    if (rock.status === "complete" || rock.status === "dropped" || rock.status === "rolled_over") throw new UserFacingError("That Rock is already closed out.");
    if (action === "complete") return tractionRepository.updateRock(tenantId, id, { status: "complete" });
    if (action === "drop") return tractionRepository.updateRock(tenantId, id, { status: "dropped" });
    const next = shiftQuarter(rock.quarter, 1);
    await tractionRepository.insertRock(tenantId, {
      title: rock.title,
      quarter: next,
      ownerPersonId: rock.ownerPersonId,
      dueDate: quarterRange(next).end,
      status: "on_track",
      successCriteria: rock.successCriteria,
      isCompany: rock.isCompany,
      oneYearGoalId: rock.oneYearGoalId,
    });
    return tractionRepository.updateRock(tenantId, id, { status: "rolled_over" });
  },

  async deleteRock(tenantId: string, id: string) {
    await activitiesService.unlinkRock(tenantId, id);
    const deleted = await tractionRepository.deleteRock(tenantId, id);
    if (!deleted) throw new UserFacingError("Rock not found.");
  },

  // ───────────── Issues ─────────────

  async getIssues(tenantId: string, now: Date = new Date()) {
    return tractionRepository.findIssues(tenantId, new Date(now.getTime() - RECENT_MS));
  },

  /** `userId` is whoever added it; it is recorded as their team person (when they are one). */
  async createIssue(tenantId: string, data: NewIssue, userId: string) {
    await assertPerson(tenantId, data.ownerPersonId);
    const raisedBy = await teamService.personForUser(tenantId, userId);
    // A measurable/rock link from another workspace is rejected by the composite foreign keys.
    return tractionRepository.insertIssue(tenantId, {
      title: data.title.trim(),
      issueType: data.issueType,
      rootCause: data.rootCause?.trim() || null,
      notes: data.notes?.trim() || null,
      horizon: data.horizon,
      ownerPersonId: data.ownerPersonId ?? null,
      raisedByPersonId: raisedBy?.id ?? null,
      measurableId: data.measurableId ?? null,
      rockId: data.rockId ?? null,
    });
  },

  async updateIssue(tenantId: string, data: IssueUpdate) {
    await assertPerson(tenantId, data.ownerPersonId);
    const updated = await tractionRepository.updateIssue(tenantId, data.id, {
      title: data.title.trim(),
      issueType: data.issueType,
      rootCause: data.rootCause?.trim() || null,
      notes: data.notes?.trim() || null,
      horizon: data.horizon,
      ownerPersonId: data.ownerPersonId ?? null,
    });
    if (!updated) throw new UserFacingError("Issue not found.");
  },

  /**
   * IDS "Solve", by kind: a problem is solved; an idea is decided yes / no / later; an obstacle is removed or
   * escalated. "later" and "escalated" keep the issue open on the long-term list (the quarterly's). A closing
   * outcome may carry any number of To-Dos — who + what + when — each linked to the issue.
   */
  async resolveIssue(tenantId: string, input: ResolveIssueInput, userId: string) {
    const issue = await tractionRepository.findIssue(tenantId, input.id);
    if (!issue) throw new UserFacingError("Issue not found.");
    if (issue.status !== "open") throw new UserFacingError("That issue is already closed.");
    if (!OUTCOMES_BY_TYPE[issue.issueType as IssueType].includes(input.outcome)) throw new UserFacingError("That outcome doesn't fit this kind of issue.");
    const effect = outcomeEffect(input.outcome);
    const todos = input.todos ?? [];
    if (todos.length && !effect.allowsTodos) throw new UserFacingError("To-Dos come with a decision to act — not with no, later or escalate.");
    for (const todo of todos) await assertPerson(tenantId, todo.assignedToPersonId);

    await tractionRepository.setIssueStatus(tenantId, input.id, effect.status, input.solution?.trim() || null, { outcome: input.outcome, horizon: effect.horizon });
    for (const todo of todos) {
      await activitiesService.create(
        tenantId,
        { type: "task", subject: todo.subject.trim(), dueDate: todo.dueDate ?? null, assignedToPersonId: todo.assignedToPersonId },
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
    await assertPerson(tenantId, data.assignedToPersonId);
    return activitiesService.create(
      tenantId,
      { type: "task", subject: data.subject.trim(), dueDate: data.dueDate ?? null, assignedToPersonId: data.assignedToPersonId },
      userId,
      { l10Todo: true }
    );
  },

  /** Everything the L10 walks through, in agenda order, plus the running meeting (if any) and the standing schedule. */
  async getMeetingData(tenantId: string) {
    const [measurables, latest, rocksData, issues, todos, meetings, live, schedule] = await Promise.all([
      tractionRepository.findMeasurables(tenantId),
      tractionRepository.findLatestEntries(tenantId),
      this.getRocks(tenantId),
      this.getIssues(tenantId),
      this.getTodos(tenantId),
      tractionRepository.findMeetings(tenantId, 5),
      tractionRepository.findLiveMeeting(tenantId),
      this.getL10Schedule(tenantId),
    ]);
    return {
      measurables,
      latest,
      rocks: rocksData.rocks.filter((r) => r.quarter === rocksData.focusQuarter),
      quarter: rocksData.focusQuarter,
      issues: issues.filter((i) => i.horizon === "short_term"),
      todos,
      meetings,
      live: live ?? null,
      schedule,
    };
  },

  /** Starts the meeting (or returns the one already running), so members can rate it from their own devices. */
  async startMeeting(tenantId: string, userId: string, now: Date = new Date()) {
    return (await tractionRepository.findLiveMeeting(tenantId)) ?? tractionRepository.insertLiveMeeting(tenantId, userId, now);
  },

  /**
   * One rating, 1–10. Each member rates for themselves; a teammate without a login can be rated for by whoever is
   * running the meeting (they have no other way to). Nobody can overwrite another member's own rating.
   */
  async rateMeeting(tenantId: string, input: { meetingId: string; personId?: string | null; rating: number }, userId: string) {
    const me = await teamService.personForUser(tenantId, userId);
    const target = input.personId ?? me?.id;
    if (!target) throw new UserFacingError("You aren't on this workspace's team yet, so there's no one to rate as.");
    if (target !== me?.id) {
      const people = await teamService.listPeople(tenantId);
      const person = people.find((p) => p.id === target);
      if (!person || person.archivedAt) throw new UserFacingError("That person isn't on this workspace's team.");
      if (person.userId) throw new UserFacingError(`${person.name} rates for themselves from their own account.`);
    }
    const updated = await tractionRepository.setMeetingRating(tenantId, input.meetingId, target, input.rating);
    if (!updated) throw new UserFacingError("That meeting has already been concluded.");
    return updated;
  },

  /**
   * Conclude: records the meeting with a snapshot of where things stood (ratings, To-Do completion, issues solved
   * during the meeting, Rocks off track, measurables off goal). Under an 8 average, EOS says the meeting itself
   * needs fixing — so a reason is required then.
   */
  async concludeMeeting(tenantId: string, input: ConcludeMeetingInput, now: Date = new Date()) {
    const live = await tractionRepository.findLiveMeeting(tenantId);
    if (!live || live.id !== input.meetingId) throw new UserFacingError("That meeting has already been concluded.");
    const values = Object.values(live.ratings);
    const average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
    if (average !== null && average < 8 && !input.improvement?.trim()) {
      throw new UserFacingError(`The meeting averaged ${average}. Write down what would make the next one a 10.`);
    }
    const [summary, issues] = await Promise.all([this.getSummary(tenantId, now), this.getIssues(tenantId, now)]);
    const started = live.startedAt ? new Date(live.startedAt).getTime() : now.getTime() - RECENT_MS;
    const concluded = await tractionRepository.concludeMeeting(tenantId, live.id, {
      heldAt: now,
      averageRating: average,
      todosDone: summary.todos.done,
      todosTotal: summary.todos.total,
      issuesSolved: issues.filter((i) => i.status === "solved" && i.solvedAt && new Date(i.solvedAt).getTime() >= started).length,
      rocksOffTrack: summary.rocks.offTrack,
      measurablesOffGoal: summary.scorecard.offGoal,
      headlines: input.headlines?.trim() || null,
      improvement: input.improvement?.trim() || null,
    });
    if (!concluded) throw new UserFacingError("That meeting has already been concluded.");
    return concluded;
  },

  async getMeetings(tenantId: string, limit = 10) {
    return tractionRepository.findMeetings(tenantId, limit);
  },

  /** The last year of weekly L10s (52), newest first. */
  async getMeetingHistory(tenantId: string, limit = 52) {
    return tractionRepository.findMeetingHistory(tenantId, limit);
  },

  /** The standing L10 time, and when the next one is (a meeting that started under 90 minutes ago is still "now"). */
  async getL10Schedule(tenantId: string, now: Date = new Date()) {
    const row = await tractionRepository.findL10Schedule(tenantId);
    if (!row) return null;
    return { weekday: row.weekday, startTime: row.startTime, timezone: row.timezone, nextAt: nextMeetingAt(row.weekday, row.startTime, row.timezone, now, 90) };
  },

  async saveL10Schedule(tenantId: string, input: L10ScheduleInput) {
    await tractionRepository.upsertL10Schedule(tenantId, input);
  },

  /**
   * The reminder sweep's half that lives here: every workspace whose L10 starts within the next hour, claimed once
   * per meeting, with the agenda points the reminder carries and who should get it. Delivery is the notifications
   * module's job.
   */
  async claimDueL10Reminders(now: Date = new Date()) {
    const due = [];
    for (const tenant of await tenancyService.listTenants()) {
      try {
        const schedule = await tractionRepository.findL10Schedule(tenant.id);
        if (!schedule) continue;
        const meetingAt = nextMeetingAt(schedule.weekday, schedule.startTime, schedule.timezone, now);
        const minutesUntil = (meetingAt.getTime() - now.getTime()) / 60000;
        if (minutesUntil <= 0 || minutesUntil > REMINDER_LEAD_MINUTES) continue;
        if (!(await tractionRepository.claimL10Reminder(tenant.id, meetingAt))) continue;

        const [data, people] = await Promise.all([this.getMeetingData(tenant.id), teamService.listPeople(tenant.id)]);
        const offGoal = data.measurables.filter((m) => goalMet(m, data.latest.find((e) => e.measurableId === m.id)?.value) === false).map((m) => m.name);
        due.push({
          tenantId: tenant.id,
          slug: tenant.slug,
          workspaceName: tenant.name,
          meetingAt,
          timezone: schedule.timezone,
          topIssues: data.issues.filter((i) => i.status === "open").slice(0, 3).map((i) => i.title),
          offGoal,
          offTrackRocks: data.rocks.filter((r) => r.status === "off_track").map((r) => r.title),
          openTodos: data.todos.filter((t) => !t.done).length,
          people: people.filter((p) => !p.archivedAt).map((p) => ({ name: p.name, email: p.email, userId: p.userId })),
        });
      } catch (error) {
        // One workspace failing must not stop the others' reminders.
        console.error(`L10 reminder failed for tenant ${tenant.id}:`, error);
      }
    }
    return due;
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
        coreValues: content.coreValues.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), behaviors: clean(v.behaviors) })),
        marketing: { ...content.marketing, uniques: clean(content.marketing.uniques) },
        threeYear: { ...content.threeYear, picture: clean(content.threeYear.picture) },
        // A new goal gets its id here; an existing one keeps it, so the Rocks pointing at it still do.
        oneYear: { ...content.oneYear, goals: content.oneYear.goals.filter((g) => g.text.trim()).map((g) => ({ id: g.id || randomUUID(), text: g.text.trim() })) },
      },
      userId
    );
  },

  // ───────────── People: Accountability Chart ─────────────

  async getSeats(tenantId: string) {
    return tractionRepository.findSeats(tenantId);
  },

  async createSeat(tenantId: string, data: NewSeat) {
    await assertPerson(tenantId, data.personId);
    const seats = await tractionRepository.findSeats(tenantId);
    if (data.parentSeatId && !seats.some((s) => s.id === data.parentSeatId)) throw new UserFacingError("The seat above this one doesn't exist.");
    return tractionRepository.insertSeat(tenantId, {
      name: data.name.trim(),
      responsibilities: data.responsibilities,
      parentSeatId: data.parentSeatId ?? null,
      personId: data.personId ?? null,
      sortOrder: seats.length,
    });
  },

  async updateSeat(tenantId: string, data: SeatUpdate) {
    await assertPerson(tenantId, data.personId);
    const seats = await tractionRepository.findSeats(tenantId);
    if (!seats.some((s) => s.id === data.id)) throw new UserFacingError("Seat not found.");
    // A seat can't report to itself or to anything below it — that would cut the branch off the chart.
    for (let parent = data.parentSeatId ?? null; parent; parent = seats.find((s) => s.id === parent)?.parentSeatId ?? null) {
      if (parent === data.id) throw new UserFacingError("A seat can't sit under itself or one of its own seats.");
    }
    await tractionRepository.updateSeat(tenantId, data.id, {
      name: data.name.trim(),
      responsibilities: data.responsibilities,
      parentSeatId: data.parentSeatId ?? null,
      personId: data.personId ?? null,
    });
  },

  async deleteSeat(tenantId: string, id: string) {
    const seat = (await tractionRepository.findSeats(tenantId)).find((s) => s.id === id);
    if (!seat) throw new UserFacingError("Seat not found.");
    await tractionRepository.deleteSeat(tenantId, id, seat.parentSeatId);
  },

  // ───────────── People: People Analyzer ─────────────

  /**
   * What one viewer may see of the People Analyzer for a quarter. It is private: a person sees their own reviews
   * (manager's and self — compared in the Quarterly Conversation), a manager also sees their direct reports' (from
   * the Accountability Chart), and a workspace admin sees everyone's.
   */
  async getPeopleAnalyzer(tenantId: string, userId: string, isAdmin: boolean, quarter: string) {
    const [people, seats, vto] = await Promise.all([teamService.listPeople(tenantId), tractionRepository.findSeats(tenantId), this.getVto(tenantId)]);
    const me = people.find((p) => p.userId === userId) ?? null;
    const active = people.filter((p) => !p.archivedAt);
    const reports = me ? directReports(seats, me.id) : [];
    const visible = isAdmin ? active.map((p) => p.id) : [...new Set([...(me ? [me.id] : []), ...reports])];
    const reviews = await tractionRepository.findReviews(tenantId, quarter, visible);
    return {
      me,
      coreValues: vto.content.coreValues.map((v) => v.name),
      people: active.filter((p) => visible.includes(p.id)),
      reviews,
      // Who may write which review: the manager's review → their manager (or an admin); the self review → the person.
      canManagerReview: isAdmin ? visible : reports,
      canSelfReview: me ? [me.id] : [],
    };
  },

  async saveReview(tenantId: string, input: ReviewInput, userId: string, isAdmin: boolean) {
    const [people, seats] = await Promise.all([teamService.listPeople(tenantId), tractionRepository.findSeats(tenantId)]);
    const me = people.find((p) => p.userId === userId) ?? null;
    if (!people.some((p) => p.id === input.personId && !p.archivedAt)) throw new UserFacingError("That person isn't on this workspace's team.");
    if (input.kind === "self" && me?.id !== input.personId) throw new UserFacingError("Only the person themselves fills in their self review.");
    if (input.kind === "manager" && !isAdmin && !(me && directReports(seats, me.id).includes(input.personId))) {
      throw new UserFacingError("Only this person's manager (the seat above theirs) or an admin can review them.");
    }
    await tractionRepository.upsertReview(tenantId, {
      personId: input.personId,
      quarter: input.quarter,
      kind: input.kind,
      reviewerPersonId: me?.id ?? null,
      valuesRatings: input.valuesRatings,
      getsIt: input.getsIt,
      wantsIt: input.wantsIt,
      capacity: input.capacity,
      notes: input.notes?.trim() || null,
    });
  },

  // ───────────── Process ─────────────

  async getProcesses(tenantId: string) {
    return tractionRepository.findProcesses(tenantId);
  },

  async createProcess(tenantId: string, data: NewProcess) {
    await assertPerson(tenantId, data.ownerPersonId);
    return tractionRepository.insertProcess(tenantId, { ...data, name: data.name.trim(), ownerPersonId: data.ownerPersonId ?? null });
  },

  async updateProcess(tenantId: string, data: ProcessUpdate) {
    await assertPerson(tenantId, data.ownerPersonId);
    const updated = await tractionRepository.updateProcess(tenantId, data.id, {
      name: data.name.trim(),
      area: data.area,
      ownerPersonId: data.ownerPersonId ?? null,
      steps: data.steps,
      stage: data.stage,
      lastReviewedAt: new Date(),
    });
    if (!updated) throw new UserFacingError("Process not found.");
  },

  /** "Reviewed, still right" — EOS updates core processes every quarter. */
  async markProcessReviewed(tenantId: string, id: string) {
    const updated = await tractionRepository.updateProcess(tenantId, id, { lastReviewedAt: new Date() });
    if (!updated) throw new UserFacingError("Process not found.");
  },

  async deleteProcess(tenantId: string, id: string) {
    const deleted = await tractionRepository.deleteProcess(tenantId, id);
    if (!deleted) throw new UserFacingError("Process not found.");
  },

  // ───────────── Overview / Portfolio ─────────────

  /** One workspace's state at a glance — the Overview tiles, the L10 snapshot and one Portfolio row. */
  async getSummary(tenantId: string, now: Date = new Date()): Promise<TractionSummary> {
    const [measurables, latest, rocks, issues, todos, meetings, checkups] = await Promise.all([
      tractionRepository.findMeasurables(tenantId),
      tractionRepository.findLatestEntries(tenantId),
      tractionRepository.findRocks(tenantId),
      this.getIssues(tenantId, now),
      this.getTodos(tenantId, now),
      tractionRepository.findMeetings(tenantId, 1),
      tractionRepository.findCheckups(tenantId),
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
    const quarterRocks = rocks.filter((r) => r.quarter === quarter && r.status !== "dropped" && r.status !== "rolled_over");
    const lastQuarter = shiftQuarter(quarterOf(today), -1);
    const lastRate = rockCompletionRate(rocks, lastQuarter);
    return {
      scorecard: { onGoal, offGoal, notEntered, total: measurables.length },
      rocks: {
        quarter,
        total: quarterRocks.length,
        complete: quarterRocks.filter((r) => r.status === "complete").length,
        onTrack: quarterRocks.filter((r) => r.status === "on_track").length,
        offTrack: quarterRocks.filter((r) => r.status === "off_track").length,
      },
      lastQuarterRockRate: lastRate === null ? null : { quarter: lastQuarter, rate: lastRate },
      openIssues: issues.filter((i) => i.status === "open" && i.horizon === "short_term").length,
      todos: { done: todos.filter((t) => t.done).length, total: todos.length },
      lastMeeting: meetings[0] ?? null,
      checkup: checkups.length ? { kickoff: checkups[0].score, latest: checkups[checkups.length - 1].score, count: checkups.length } : null,
    };
  },

  /** Where the workspace is using the system against an EOS rule (Overview's checklist). */
  async getRuleChecks(tenantId: string, now: Date = new Date()) {
    const [summary, measurables, rocks, issues, vto, seats] = await Promise.all([
      this.getSummary(tenantId, now),
      tractionRepository.findMeasurables(tenantId),
      tractionRepository.findRocks(tenantId),
      this.getIssues(tenantId, now),
      this.getVto(tenantId),
      tractionRepository.findSeats(tenantId),
    ]);
    return eosRuleChecks({
      measurables,
      rocks,
      currentQuarter: quarterOf(todayIso(now)),
      lastFinishedQuarterRate: summary.lastQuarterRockRate?.rate ?? null,
      openIssues: issues.filter((i) => i.status === "open"),
      todos: summary.todos,
      lastMeetingRating: summary.lastMeeting?.averageRating ?? null,
      coreValuesCount: vto.content.coreValues.length,
      oneYearGoalsCount: vto.content.oneYear.goals.length,
      seatsWithoutPerson: seats.filter((s) => !s.personId).length,
      now,
    });
  },

  /**
   * The super admin's Portfolio: one summary per active workspace. Each one is read through its own `withTenant`
   * (inside getSummary) — never one query across tenants, so RLS still holds every row to its workspace.
   */
  async getPortfolio(now: Date = new Date()) {
    const tenants = await tenancyService.listTenants();
    return Promise.all(tenants.map(async (t) => ({ tenantId: t.id, slug: t.slug, name: t.name, summary: await this.getSummary(t.id, now) })));
  },

  // ───────────── Organizational Checkup ─────────────

  /** Every checkup, oldest first — the first is the kickoff baseline the rest are measured against. */
  async getCheckups(tenantId: string) {
    return tractionRepository.findCheckups(tenantId);
  },

  /** Saves one checkup. Every statement must be answered (`statementCount` = the current statement list's length). */
  async saveCheckup(tenantId: string, input: { answers: number[]; notes?: string | null }, statementCount: number, userId: string) {
    if (input.answers.length !== statementCount) throw new UserFacingError(`Score all ${statementCount} statements before saving.`);
    return tractionRepository.insertCheckup(tenantId, {
      answers: input.answers,
      score: checkupScore(input.answers, statementCount),
      notes: input.notes?.trim() || null,
      takenByUserId: userId,
    });
  },

  async deleteCheckup(tenantId: string, id: string) {
    const deleted = await tractionRepository.deleteCheckup(tenantId, id);
    if (!deleted) throw new UserFacingError("Checkup not found.");
  },

  // ───────────── The portfolio's standard measurables ─────────────

  /** Which of the portfolio's standard measurables this workspace doesn't have yet (matched by name, any case). */
  async missingStandardMeasurables(tenantId: string, standard: StandardMeasurable[]) {
    const have = new Set((await tractionRepository.findMeasurables(tenantId)).map((m) => m.name.trim().toLowerCase()));
    return standard.filter((s) => !have.has(s.name.trim().toLowerCase()));
  },

  /** Copies in the standard measurables this workspace is missing. The company then gives each one its owner. */
  async addStandardMeasurables(tenantId: string, standard: StandardMeasurable[]) {
    const missing = await this.missingStandardMeasurables(tenantId, standard);
    let sortOrder = await tractionRepository.nextMeasurableSortOrder(tenantId);
    for (const s of missing) {
      // Field by field: a template row carries its own id, which must never become this workspace's measurable id.
      await tractionRepository.insertMeasurable(tenantId, {
        name: s.name,
        cadence: s.cadence,
        unit: s.unit,
        aggregation: s.aggregation,
        goalOperator: s.goalOperator,
        goalValue: s.goalValue,
        goalValueMax: s.goalValueMax,
        ownerPersonId: null,
        sortOrder: sortOrder++,
      });
    }
    return missing.length;
  },

  /**
   * The portfolio's standard numbers for one workspace: for each standard measurable (by name), its latest value and
   * whether it is on goal — so the Portfolio page can line the companies up side by side.
   */
  async getStandardNumbers(tenantId: string, standard: StandardMeasurable[]) {
    const [measurables, latest] = await Promise.all([tractionRepository.findMeasurables(tenantId), tractionRepository.findLatestEntries(tenantId)]);
    return standard.map((s) => {
      const m = measurables.find((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase());
      const entry = m ? latest.find((e) => e.measurableId === m.id) : undefined;
      return { name: s.name, unit: m?.unit ?? s.unit, tracked: !!m, value: entry?.value ?? null, periodStart: entry?.periodStart ?? null, met: m && entry ? goalMet(m, entry.value) : null };
    });
  },
};
