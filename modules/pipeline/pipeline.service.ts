import { UserFacingError } from "@/lib/errors";
import { pipelineRepository, pipelineBoardsRepository } from "./pipeline.repository";
import { activitiesService } from "@/modules/activities/activities.service";
import { DEFAULT_BOARD_NAME, DEFAULT_BOARD_COLUMNS } from "./pipeline.constants";
import type { NewPipelineItem, NewBoard, UpdateBoardColumns } from "./pipeline.types";
import type { BoardColumn } from "./pipeline.schema";

function slugifyColumnId(label: string, index: number, taken: Set<string>) {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = base || `column_${index}`;
  if (!taken.has(id)) return id;
  let candidate = `${id}_${index}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${id}_${index}_${n}`;
  return candidate;
}

export const pipelineService = {
  async listBoards(tenantId: string) {
    return pipelineBoardsRepository.findAllForTenant(tenantId);
  },

  /** Every user-created board (active and archived) — the Projects page's tabs + its "Manage" list. */
  async listProjectBoards(tenantId: string) {
    const boards = await pipelineBoardsRepository.findAllForTenant(tenantId);
    return boards.filter((board) => !board.isSystem);
  },

  /** The system board is off-limits to rename/archive/delete — it's what /leads is built on. */
  async getEditableBoard(tenantId: string, id: string) {
    const board = await pipelineBoardsRepository.findById(tenantId, id);
    if (!board) {
      throw new UserFacingError("Project not found.");
    }
    if (board.isSystem) {
      throw new UserFacingError("The Leads board can't be changed.");
    }
    return board;
  },

  async renameBoard(tenantId: string, id: string, name: string) {
    await this.getEditableBoard(tenantId, id);
    return pipelineBoardsRepository.update(tenantId, id, { name: name.trim() });
  },

  /**
   * Edits a project's stages: rename, reorder, add and remove. A kept stage keeps its id, so its cards stay in it however it
   * is renamed or moved. Removing a stage that still holds cards needs somewhere for them to go (`moveRemovedTo`, an existing
   * stage that is kept) — they are moved in the same transaction as the board update, so none is ever left on a stage the
   * board no longer has. The Leads board is off-limits like for every other change.
   */
  async updateBoardColumns(tenantId: string, input: UpdateBoardColumns) {
    const board = await this.getEditableBoard(tenantId, input.id);
    const existing = new Set(board.columns.map((c) => c.id));

    const kept = new Set<string>();
    const taken = new Set(existing);
    const columns: BoardColumn[] = input.columns.map((c, index) => {
      if (c.id) {
        if (!existing.has(c.id) || kept.has(c.id)) throw new UserFacingError("That stage doesn't belong to this project. Reload the page and try again.");
        kept.add(c.id);
        return { id: c.id, label: c.label };
      }
      const id = slugifyColumnId(c.label, index, taken);
      taken.add(id);
      return { id, label: c.label };
    });

    const removed = board.columns.filter((c) => !kept.has(c.id)).map((c) => c.id);
    let move: { from: string[]; to: string } | undefined;
    if (removed.length > 0) {
      const counts = await pipelineRepository.countByStage(tenantId, input.id);
      const affected = removed.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
      if (affected > 0) {
        if (!input.moveRemovedTo || !kept.has(input.moveRemovedTo)) {
          throw new UserFacingError(`Choose which stage the ${affected} card${affected === 1 ? "" : "s"} in the removed stage${removed.length === 1 ? "" : "s"} should move to.`);
        }
        move = { from: removed, to: input.moveRemovedTo };
      }
    }

    return pipelineBoardsRepository.updateColumns(tenantId, input.id, columns, move);
  },

  async setBoardArchived(tenantId: string, id: string, archived: boolean) {
    await this.getEditableBoard(tenantId, id);
    return pipelineBoardsRepository.update(tenantId, id, { archivedAt: archived ? new Date() : null });
  },

  /**
   * Deletes the board and its items. Activities linked to those items are
   * kept (they may already be done or still due) — they're just detached,
   * so they stay visible on /activities instead of silently disappearing.
   */
  async deleteBoard(tenantId: string, id: string) {
    await this.getEditableBoard(tenantId, id);
    const itemIds = await pipelineRepository.findIdsForBoard(tenantId, id);
    await activitiesService.unlinkPipelineItems(tenantId, itemIds);
    await pipelineRepository.deleteMany(tenantId, itemIds);
    await pipelineBoardsRepository.delete(tenantId, id);
  },

  /**
   * Every tenant needs the "Leads" system board to exist before /leads
   * can render — seeded lazily on first visit
   * rather than at tenant-creation time, so tenants created before this
   * feature existed still get one.
   */
  async ensureDefaultBoard(tenantId: string) {
    const existing = await pipelineBoardsRepository.findSystemBoard(tenantId);
    if (existing) return existing;
    return pipelineBoardsRepository.create(tenantId, {
      name: DEFAULT_BOARD_NAME,
      columns: DEFAULT_BOARD_COLUMNS,
      isSystem: true,
    });
  },

  async createBoard(tenantId: string, data: NewBoard) {
    const taken = new Set<string>();
    const columns: BoardColumn[] = data.columns.map((c, index) => {
      const id = slugifyColumnId(c.label, index, taken);
      taken.add(id);
      return { id, label: c.label };
    });
    return pipelineBoardsRepository.create(tenantId, { name: data.name, columns });
  },

  async listForBoard(tenantId: string, boardId: string) {
    return pipelineRepository.findAllForBoard(tenantId, boardId);
  },

  async listAllForTenant(tenantId: string) {
    return pipelineRepository.findAllForTenant(tenantId);
  },

  async getById(tenantId: string, id: string) {
    const item = await pipelineRepository.findByIdWithRelations(tenantId, id);
    if (!item) {
      throw new UserFacingError("Pipeline item not found.");
    }
    return item;
  },

  async create(tenantId: string, data: NewPipelineItem) {
    return pipelineRepository.create(tenantId, data);
  },

  async moveStage(tenantId: string, id: string, stage: string) {
    const updated = await pipelineRepository.updateStage(tenantId, id, stage);
    if (!updated) {
      throw new UserFacingError("Pipeline item not found.");
    }
    return updated;
  },

  async update(tenantId: string, id: string, data: Partial<NewPipelineItem>) {
    const updated = await pipelineRepository.update(tenantId, id, data);
    if (!updated) {
      throw new UserFacingError("Pipeline item not found.");
    }
    return updated;
  },
};
