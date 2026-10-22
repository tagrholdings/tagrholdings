import type { ActivityRow } from "@/modules/activities/activities.types";
import { toZonedInputValues } from "@/utils/date";
import { dueDay } from "./slack.logic";

/**
 * Numbers the bot reports about the pipeline: asked for in Slack ("how's the pipeline?") and the base of the weekly report.
 * Pure — the caller hands in the lists it already loaded — so it is cheap to test and gives the same answer everywhere.
 *
 * Two things the database does not record, so they are approximated and the report says so:
 *  - there is no stage history: "moved" can only be "edited" (`updatedAt` also changes on any edit);
 *  - there is no completion time on activities: "done this week" is `done` and `updatedAt` in the last 7 days.
 * And one assumption: the LAST stage of a board is its "finished" stage (Closed, Done) — cards there are never "stale".
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 14;

export interface SummaryItem {
  id: string;
  title: string;
  boardId: string;
  stage: string;
  boardName: string;
  boardIsSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SummaryBoard {
  id: string;
  name: string;
  isSystem: boolean;
  archivedAt: Date | null;
  columns: { id: string; label: string }[];
}

export interface PipelineSummary {
  boards: { name: string; isLeads: boolean; total: number; stages: { label: string; count: number }[] }[];
  createdLast7Days: { count: number; titles: string[] };
  /** Open cards nobody has touched for STALE_AFTER_DAYS or more, longest idle first (at most 10). */
  stale: { title: string; board: string; stage: string; daysIdle: number }[];
  staleTotal: number;
  activities: { overdue: number; dueToday: number; doneLast7Days: number };
  newLeadsToReview: number;
}

export function summarizePipeline(input: { items: SummaryItem[]; boards: SummaryBoard[]; activities: ActivityRow[]; newLeads: number; now: Date; timeZone: string }): PipelineSummary {
  const { items, activities, now, timeZone } = input;
  const boards = input.boards.filter((b) => !b.archivedAt);
  const lastStage = new Map(boards.map((b) => [b.id, b.columns.at(-1)?.id]));
  const weekAgo = now.getTime() - 7 * DAY_MS;

  const byBoard = boards.map((board) => {
    const own = items.filter((i) => i.boardId === board.id);
    return {
      name: board.name,
      isLeads: board.isSystem,
      total: own.length,
      stages: board.columns.map((c) => ({ label: c.label, count: own.filter((i) => i.stage === c.id).length })),
    };
  });

  const created = items.filter((i) => new Date(i.createdAt).getTime() >= weekAgo);
  const staleAll = items
    .filter((i) => i.stage !== lastStage.get(i.boardId) && boards.some((b) => b.id === i.boardId))
    .map((i) => ({ title: i.title, board: i.boardName, stage: boards.find((b) => b.id === i.boardId)?.columns.find((c) => c.id === i.stage)?.label ?? i.stage, daysIdle: Math.floor((now.getTime() - new Date(i.updatedAt).getTime()) / DAY_MS) }))
    .filter((i) => i.daysIdle >= STALE_AFTER_DAYS)
    .sort((a, b) => b.daysIdle - a.daysIdle);

  const today = toZonedInputValues(now, timeZone).date;
  const open = activities.filter((a) => !a.done);
  const dayOf = (a: ActivityRow) => (a.dueDate ? dueDay(a.dueDate, a.timezone, timeZone) : null);

  return {
    boards: byBoard,
    createdLast7Days: { count: created.length, titles: created.slice(0, 5).map((i) => i.title) },
    stale: staleAll.slice(0, 10),
    staleTotal: staleAll.length,
    activities: {
      overdue: open.filter((a) => (dayOf(a) ?? "9999-12-31") < today).length,
      dueToday: open.filter((a) => dayOf(a) === today).length,
      doneLast7Days: activities.filter((a) => a.done && a.updatedAt && new Date(a.updatedAt).getTime() >= weekAgo).length,
    },
    newLeadsToReview: input.newLeads,
  };
}
