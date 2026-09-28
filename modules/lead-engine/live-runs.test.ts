import { describe, expect, it } from "vitest";
import { activeRunFor, featuredRun, parseRunTitle, runCoversProfile, type LiveRun } from "./live-runs";

const PROFILE = "3f8a1c2e-6b1d-4c7a-9a52-0d3c5f1e7b90";
const NOW = new Date("2026-09-28T15:00:00Z").getTime();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const run = (over: Partial<LiveRun> = {}): LiveRun => ({
  id: 1,
  number: 10,
  title: "Lead engine · scheduled",
  scope: { kind: "all", trigger: "scheduled" },
  status: "in_progress",
  conclusion: null,
  url: "https://github.com/o/r/actions/runs/1",
  createdAt: iso(60_000),
  startedAt: iso(50_000),
  updatedAt: iso(5_000),
  steps: [],
  ...over,
});

const profile = (over: Partial<{ id: string; frequencyHours: number; lastRunAt: Date | null; runRequestedAt: Date | null }> = {}) => ({
  id: PROFILE,
  frequencyHours: 24,
  lastRunAt: new Date(NOW - 2 * 86_400_000), // overdue
  runRequestedAt: null,
  ...over,
});

describe("parseRunTitle", () => {
  it("a Run now run carries its profile id", () => {
    expect(parseRunTitle(`Lead engine · engine ${PROFILE}`)).toEqual({ kind: "profile", profileId: PROFILE });
    expect(parseRunTitle(`Lead engine · engine ${PROFILE.toUpperCase()}`)).toEqual({ kind: "profile", profileId: PROFILE }); // normalised
  });

  it("recognises signups, the schedule, and a manual whole-engine run", () => {
    expect(parseRunTitle("Lead engine · email-signups ")).toEqual({ kind: "signups" });
    expect(parseRunTitle("Lead engine · scheduled")).toEqual({ kind: "all", trigger: "scheduled" });
    expect(parseRunTitle("Lead engine · engine ")).toEqual({ kind: "all", trigger: "manual" });
  });

  it("an old run titled after its commit message reads as a whole-engine run", () => {
    expect(parseRunTitle("feat: instant portal access")).toEqual({ kind: "all", trigger: "manual" });
    expect(parseRunTitle(null)).toEqual({ kind: "all", trigger: "manual" });
    // ...unless GitHub says the schedule started it.
    expect(parseRunTitle("Lead engine", "schedule")).toEqual({ kind: "all", trigger: "scheduled" });
    expect(parseRunTitle("Lead engine", "workflow_dispatch")).toEqual({ kind: "all", trigger: "manual" });
  });
});

describe("runCoversProfile / activeRunFor", () => {
  it("a profile run covers only its own profile", () => {
    const r = run({ scope: { kind: "profile", profileId: PROFILE } });
    expect(runCoversProfile(r, profile())).toBe(true);
    expect(runCoversProfile(r, profile({ id: "aaaaaaaa-6b1d-4c7a-9a52-0d3c5f1e7b90" }))).toBe(false);
  });

  it("a whole-engine run covers the profiles that were due when it started, not the others", () => {
    const r = run();
    expect(runCoversProfile(r, profile())).toBe(true); // overdue
    expect(runCoversProfile(r, profile({ lastRunAt: new Date(NOW - 3_600_000) }))).toBe(false); // ran an hour ago, not due
    expect(runCoversProfile(r, profile({ lastRunAt: new Date(NOW - 3_600_000), runRequestedAt: new Date(NOW - 1000) }))).toBe(true); // Run now pending
  });

  it("a signups run touches no profile", () => {
    expect(runCoversProfile(run({ scope: { kind: "signups" } }), profile())).toBe(false);
  });

  it("only active runs count, and the newest wins", () => {
    const finished = run({ id: 3, status: "completed", conclusion: "success" });
    const older = run({ id: 2 });
    const newest = run({ id: 1, status: "queued" });
    expect(activeRunFor([finished, newest, older], profile())?.id).toBe(1);
    expect(activeRunFor([finished], profile())).toBeUndefined();
  });
});

describe("featuredRun", () => {
  it("prefers the active run", () => {
    const done = run({ id: 2, status: "completed", conclusion: "success", updatedAt: iso(1000) });
    expect(featuredRun([done, run({ id: 1 })], NOW)?.id).toBe(1);
  });

  it("keeps a run that just finished on screen for ten minutes, then lets it go", () => {
    expect(featuredRun([run({ status: "completed", conclusion: "success", updatedAt: iso(5 * 60_000) })], NOW)).toBeDefined();
    expect(featuredRun([run({ status: "completed", conclusion: "success", updatedAt: iso(11 * 60_000) })], NOW)).toBeUndefined();
  });
});
