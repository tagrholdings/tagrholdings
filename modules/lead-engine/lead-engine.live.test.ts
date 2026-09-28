import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lead-engine.repository", () => ({ leadEngineRepository: {} }));
vi.mock("@/lib/github-actions", () => ({ listLeadEngineRuns: vi.fn(), getRunSteps: vi.fn() }));
vi.mock("@/modules/search-profiles/search-profiles.service", () => ({ searchProfilesService: { listForTenant: vi.fn() } }));

import { leadEngineService } from "./lead-engine.service";
import { getRunSteps, listLeadEngineRuns } from "@/lib/github-actions";
import { searchProfilesService } from "@/modules/search-profiles/search-profiles.service";

const NOW = new Date("2026-09-28T15:00:00Z");
const OWN = "3f8a1c2e-6b1d-4c7a-9a52-0d3c5f1e7b90";
const OTHER = "9b2f6a10-1c3d-4e5f-8a7b-2c4d6e8f0a1b";

const gh = (id: number, title: string, status: "queued" | "in_progress" | "completed" = "in_progress") => ({
  id,
  runNumber: id,
  title,
  event: "workflow_dispatch",
  status,
  conclusion: status === "completed" ? ("success" as const) : null,
  url: `https://github.com/o/r/actions/runs/${id}`,
  createdAt: "2026-09-28T14:58:00Z",
  startedAt: "2026-09-28T14:58:30Z",
  updatedAt: "2026-09-28T14:59:50Z",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchProfilesService.listForTenant).mockResolvedValue([{ id: OWN }] as never);
  vi.mocked(getRunSteps).mockResolvedValue({ configured: true, ok: true, data: [{ name: "Run the engine", status: "in_progress", conclusion: null }] });
});

describe("getLiveRuns", () => {
  it("says so when GitHub isn't connected, without calling anything else", async () => {
    vi.mocked(listLeadEngineRuns).mockResolvedValue({ configured: false });
    expect(await leadEngineService.getLiveRuns("t1", NOW)).toMatchObject({ configured: false, runs: [] });
    expect(searchProfilesService.listForTenant).not.toHaveBeenCalled();
  });

  it("reports GitHub being unreachable as unavailable rather than as 'nothing running'", async () => {
    vi.mocked(listLeadEngineRuns).mockResolvedValue({ configured: true, ok: false });
    expect(await leadEngineService.getLiveRuns("t1", NOW)).toMatchObject({ configured: true, unavailable: true, runs: [] });
  });

  it("hides runs started for another workspace's profile, but keeps profile-less (scheduled) runs", async () => {
    vi.mocked(listLeadEngineRuns).mockResolvedValue({
      configured: true,
      ok: true,
      data: [gh(3, `Lead engine · engine ${OTHER}`), gh(2, `Lead engine · engine ${OWN}`), gh(1, "Lead engine · scheduled")],
    });
    const result = await leadEngineService.getLiveRuns("t1", NOW);
    expect(result.runs.map((r) => r.id)).toEqual([2, 1]);
    expect(result.runs[0].scope).toEqual({ kind: "profile", profileId: OWN });
  });

  it("fetches steps only for the featured run (the active one)", async () => {
    vi.mocked(listLeadEngineRuns).mockResolvedValue({
      configured: true,
      ok: true,
      data: [gh(2, `Lead engine · engine ${OWN}`, "in_progress"), gh(1, "Lead engine · scheduled", "completed")],
    });
    const result = await leadEngineService.getLiveRuns("t1", NOW);
    expect(getRunSteps).toHaveBeenCalledTimes(1);
    expect(getRunSteps).toHaveBeenCalledWith(2);
    expect(result.runs[0].steps).toHaveLength(1);
    expect(result.runs[1].steps).toEqual([]);
  });

  it("skips the steps call when nothing is running and nothing finished recently", async () => {
    const old = { ...gh(1, "Lead engine · scheduled", "completed"), updatedAt: "2026-09-28T09:00:00Z" };
    vi.mocked(listLeadEngineRuns).mockResolvedValue({ configured: true, ok: true, data: [old] });
    await leadEngineService.getLiveRuns("t1", NOW);
    expect(getRunSteps).not.toHaveBeenCalled();
  });
});
