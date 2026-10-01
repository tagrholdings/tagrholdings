import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pipeline.repository", () => ({
  pipelineRepository: { countByStage: vi.fn() },
  pipelineBoardsRepository: { findById: vi.fn(), updateColumns: vi.fn() },
}));
vi.mock("@/modules/activities/activities.service", () => ({ activitiesService: { unlinkPipelineItems: vi.fn() } }));

import { pipelineService } from "./pipeline.service";
import { pipelineRepository, pipelineBoardsRepository } from "./pipeline.repository";

const boards = vi.mocked(pipelineBoardsRepository);
const items = vi.mocked(pipelineRepository);
const BOARD_ID = "b1b1b1b1-0000-4000-8000-000000000001";
const board = {
  id: BOARD_ID,
  isSystem: false,
  columns: [
    { id: "todo", label: "To do" },
    { id: "doing", label: "In progress" },
    { id: "done", label: "Done" },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  boards.findById.mockResolvedValue(board as never);
  boards.updateColumns.mockResolvedValue({ ...board } as never);
  items.countByStage.mockResolvedValue({});
});

describe("updateBoardColumns", () => {
  it("renaming a stage keeps its id, so its cards stay in it", async () => {
    await pipelineService.updateBoardColumns("t1", {
      id: BOARD_ID,
      columns: [{ id: "todo", label: "Backlog" }, { id: "doing", label: "In progress" }, { id: "done", label: "Done" }],
    });
    const [, , columns, move] = boards.updateColumns.mock.calls[0];
    expect(columns).toEqual([
      { id: "todo", label: "Backlog" },
      { id: "doing", label: "In progress" },
      { id: "done", label: "Done" },
    ]);
    expect(move).toBeUndefined();
  });

  it("reordering just saves the new order", async () => {
    await pipelineService.updateBoardColumns("t1", {
      id: BOARD_ID,
      columns: [{ id: "done", label: "Done" }, { id: "todo", label: "To do" }, { id: "doing", label: "In progress" }],
    });
    expect(boards.updateColumns.mock.calls[0][2].map((c) => c.id)).toEqual(["done", "todo", "doing"]);
  });

  it("a new stage gets an id that never collides with an existing one (even one that was removed)", async () => {
    await pipelineService.updateBoardColumns("t1", {
      id: BOARD_ID,
      columns: [{ id: "todo", label: "To do" }, { label: "Done" }, { label: "In progress" }],
    });
    const ids = boards.updateColumns.mock.calls[0][2].map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe("todo");
    expect(ids).not.toContain("done"); // "doing" and "done" were removed, but their ids stay reserved
  });

  it("removing an empty stage needs no destination", async () => {
    await pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "todo", label: "To do" }, { id: "done", label: "Done" }] });
    expect(boards.updateColumns.mock.calls[0][3]).toBeUndefined();
  });

  it("removing a stage that holds cards moves them to the chosen stage, in the same call", async () => {
    items.countByStage.mockResolvedValue({ doing: 4, done: 2 });
    await pipelineService.updateBoardColumns("t1", {
      id: BOARD_ID,
      columns: [{ id: "todo", label: "To do" }, { id: "done", label: "Done" }],
      moveRemovedTo: "todo",
    });
    expect(boards.updateColumns.mock.calls[0][3]).toEqual({ from: ["doing"], to: "todo" });
  });

  it("refuses to remove a stage with cards when no destination is chosen", async () => {
    items.countByStage.mockResolvedValue({ doing: 1 });
    await expect(
      pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "todo", label: "To do" }, { id: "done", label: "Done" }] })
    ).rejects.toThrow("Choose which stage the 1 card");
    expect(boards.updateColumns).not.toHaveBeenCalled();
  });

  it("the destination must be a stage that is kept — not a removed one, not an unknown one", async () => {
    items.countByStage.mockResolvedValue({ doing: 3 });
    for (const moveRemovedTo of ["doing", "nope"]) {
      await expect(
        pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "todo", label: "To do" }, { id: "done", label: "Done" }], moveRemovedTo })
      ).rejects.toThrow("Choose which stage");
    }
    expect(boards.updateColumns).not.toHaveBeenCalled();
  });

  it("rejects a stage id that isn't on this board, or the same stage twice", async () => {
    await expect(
      pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "from-another-board", label: "X" }] })
    ).rejects.toThrow("doesn't belong");
    await expect(
      pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "todo", label: "A" }, { id: "todo", label: "B" }] })
    ).rejects.toThrow("doesn't belong");
    expect(boards.updateColumns).not.toHaveBeenCalled();
  });

  it("the Leads board can't be changed", async () => {
    boards.findById.mockResolvedValue({ ...board, isSystem: true } as never);
    await expect(pipelineService.updateBoardColumns("t1", { id: BOARD_ID, columns: [{ id: "todo", label: "To do" }] })).rejects.toThrow("can't be changed");
  });
});
