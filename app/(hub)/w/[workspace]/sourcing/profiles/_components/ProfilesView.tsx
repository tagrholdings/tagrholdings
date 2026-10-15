"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Radar, Zap } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { PageSlotContent, MOBILE_GHOST } from "@/components/layout/page-slots";
import { Pagination } from "@/components/ui/pagination";
import { useFitPageSize } from "@/hooks/ui/use-fit-page-size";
import { paginate } from "@/utils/pagination";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { runSearchProfileNowAction, updateSearchProfileAction } from "@/modules/search-profiles/search-profiles.actions";
import { formatUsdCompact } from "@/modules/search-profiles/fit";
import { formatCountdown, nextEngineRunAt } from "@/modules/search-profiles/schedule";
import { useNow } from "@/hooks/ui/use-now";
import { useLeadEngineStatus } from "@/hooks/lead-engine/useLeadEngineStatus";
import { activeRunFor, isRunActive, type LiveRun } from "@/modules/lead-engine/live-runs";
import type { ProfileSources, QualificationCriteria } from "@/modules/search-profiles/search-profiles.schema";
import type { SearchProfileSummary } from "@/modules/search-profiles/search-profiles.types";
import { SearchProfileVault } from "./SearchProfileVault";
import { LiveRunSection } from "./LiveRunCard";

const SOURCE_SHORT_LABELS: Record<keyof ProfileSources, string> = {
  google_places: "Places",
  brave_search: "Brave",
  broker_listings: "Brokers",
  marketplace_scrape: "Marketplace",
  company_site_scrape: "Websites",
};

/** One line summarising the criteria ("Revenue $1M–$5M · Profit ≥ $150K · signals: retiring"), or null when none are set. */
function criteriaSummary(c: QualificationCriteria | null): string | null {
  if (!c) return null;
  const span = (label: string, lo: number | undefined, hi: number | undefined, fmt: (n: number) => string) =>
    lo !== undefined && hi !== undefined ? `${label} ${fmt(lo)}–${fmt(hi)}` : lo !== undefined ? `${label} ≥ ${fmt(lo)}` : hi !== undefined ? `${label} ≤ ${fmt(hi)}` : null;
  const parts = [
    span("Revenue", c.minRevenue, c.maxRevenue, formatUsdCompact),
    span("Profit", c.minProfit, c.maxProfit, formatUsdCompact),
    c.maxAskingPrice !== undefined ? `Price ≤ ${formatUsdCompact(c.maxAskingPrice)}` : null,
    span("Employees", c.minEmployees, c.maxEmployees, String),
    c.minYearsInBusiness !== undefined ? `${c.minYearsInBusiness}+ yrs` : null,
    c.signalKeywords?.length ? `signals: ${c.signalKeywords.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * What is happening with a profile, in order of how real it is:
 *  1. a GitHub Actions run is working on it right now → "Running on GitHub" / "Queued on GitHub" (live);
 *  2. a "Run now" was asked for but no run is listed (yet) → "Starting on GitHub…", or — when GitHub isn't
 *     connected — that it waits for the next scheduled run, with the countdown;
 *  3. otherwise the plain schedule: green dot + countdown to the engine tick that will run it (schedule.ts).
 * "Active" means scheduled, not mid-run: the engine is a job that starts on a cron.
 */
function NextRun({
  profile,
  queued,
  liveRun,
  githubLive,
}: {
  profile: SearchProfileSummary;
  queued: boolean;
  liveRun: LiveRun | undefined;
  githubLive: boolean;
}) {
  const now = useNow();
  const remaining = now === null ? null : nextEngineRunAt(profile, now) - now;

  let dot = "bg-green-500";
  let tone = "text-green-800 dark:text-green-400";
  let ping = true;
  let label = "Active";
  let detail: string;

  if (liveRun?.status === "in_progress") {
    label = "Running on GitHub";
    detail = now === null ? "…" : `For ${formatCountdown(now - new Date(liveRun.startedAt ?? liveRun.createdAt).getTime())}`;
  } else if (liveRun) {
    dot = "bg-amber-500";
    tone = "text-amber-800 dark:text-amber-400";
    label = "Queued on GitHub";
    detail = "Waiting for a runner";
  } else if (queued && githubLive) {
    dot = "bg-amber-500";
    tone = "text-amber-800 dark:text-amber-400";
    label = "Starting on GitHub…";
    detail = "The run should appear in a few seconds";
  } else if (queued) {
    dot = "bg-amber-500";
    tone = "text-amber-800 dark:text-amber-400";
    ping = false;
    label = "Queued";
    detail = remaining === null ? "…" : `Waits for the scheduled run · in ${formatCountdown(remaining)}`;
  } else {
    detail = remaining === null ? "…" : `Next run in ${formatCountdown(remaining)}`;
  }

  return (
    <div className="min-w-0 text-right md:text-left">
      <span className={`flex items-center justify-end gap-1.5 text-sm font-medium md:justify-start ${tone}`}>
        <span className="relative flex size-2 shrink-0" aria-hidden>
          {ping && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dot}`} />}
          <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
        </span>
        {label}
      </span>
      <span className="block text-xs tabular-nums text-muted-foreground">{detail}</span>
    </div>
  );
}

// Table geometry for the one-screen page (see useFitPageSize): a row is up to three lines tall.
const ROW_HEIGHT = 92;
const RESERVED_HEIGHT = 104;

export function ProfilesView({ profiles }: { profiles: SearchProfileSummary[] }) {
  // undefined = closed, null = creating, profile = editing.
  const [editing, setEditing] = useState<SearchProfileSummary | null | undefined>(undefined);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // When each profile's "Run now" was asked for in this session — the row flips to "Queued" before the server list
  // refreshes, and stops being queued once the profile has a run that finished after it (lastRunAt moves).
  const [queuedAt, setQueuedAt] = useState<Record<string, number>>({});
  const router = useRouter();
  const { status, startWatching } = useLeadEngineStatus();
  const runs = status?.runs ?? [];
  const githubLive = status?.configured === true && !status.unavailable;
  const profileNames = Object.fromEntries(profiles.map((p) => [p.id.toLowerCase(), p.name]));

  // When the last active run ends, reload the server data: the profiles' last-run dates, and the inbox count, moved.
  const wasRunning = useRef(false);
  const running = runs.some(isRunActive);
  useEffect(() => {
    if (wasRunning.current && !running) router.refresh();
    wasRunning.current = running;
  }, [running, router]);
  // "Now" for judging how old a queued request is — read once on mount (render must stay pure); good enough for a 15-minute window.
  const [mountedAt] = useState(() => Date.now());

  const [page, setPage] = useState(1);
  const { ref: fitRef, pageSize } = useFitPageSize({ rowHeight: ROW_HEIGHT, reserved: RESERVED_HEIGHT });

  const isActive = (p: SearchProfileSummary) => activeOverrides[p.id] ?? p.active;

  async function toggleActive(profile: SearchProfileSummary) {
    const next = !isActive(profile);
    setBusyId(profile.id);
    try {
      const result = await updateSearchProfileAction({ id: profile.id, active: next });
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? "Couldn't update that profile. Please try again.");
        return;
      }
      setActiveOverrides((prev) => ({ ...prev, [profile.id]: next }));
      notify.success(next ? "Profile resumed." : "Profile paused — the engine will skip it.");
    } finally {
      setBusyId(null);
    }
  }

  async function runNow(profile: SearchProfileSummary) {
    setBusyId(profile.id);
    try {
      const result = await runSearchProfileNowAction({ id: profile.id });
      if (!result?.data) {
        notify.error(result?.serverError ?? "Couldn't queue that run. Please try again.");
        return;
      }
      setQueuedAt((prev) => ({ ...prev, [profile.id]: Date.now() }));
      if (result.data.dispatch === "dispatched") {
        notify.success("Run started on GitHub — follow it live above the list.", 6000);
        startWatching();
      }
      else notify.info("Run queued. It starts with the engine's next scheduled run (the CRM can't start it instantly until GitHub is connected).", 8000);
    } finally {
      setBusyId(null);
    }
  }

  const paged = paginate(profiles, page, pageSize);

  const createButton = (
    <PageSlotContent name="tabs">
      <Button data-tour="profiles-create" className={MOBILE_GHOST} onClick={() => setEditing(null)}>
        <Plus />
        <span className="hidden sm:inline">Add profile</span>
      </Button>
    </PageSlotContent>
  );

  const vault = (
    <SearchProfileVault
      open={editing !== undefined}
      onOpenChange={(open) => !open && setEditing(undefined)}
      profile={editing ?? null}
    />
  );

  if (profiles.length === 0) {
    return (
      <>
        <Empty data-tour="profiles-table">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Radar />
            </EmptyMedia>
            <EmptyTitle>No search profiles yet</EmptyTitle>
            <EmptyDescription>
              A search profile tells the engine what to look for — an industry and an area. Add one and it starts on the next scheduled run.
            </EmptyDescription>
          </EmptyHeader>
          {createButton}
        </Empty>
        {vault}
      </>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 justify-end empty:hidden">{createButton}</div>

      <LiveRunSection runs={runs} profileNames={profileNames} />

      <div ref={fitRef} className="flex min-h-0 flex-1 flex-col gap-4 md:overflow-hidden">
      <Table data-tour="profiles-table" className="md:min-h-0 md:overflow-y-auto">
        <TableHeader>
          <tr>
            <TableHead>Profile</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead>Cap / frequency</TableHead>
            <TableHead>Last run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {paged.items.map((profile) => {
            const active = isActive(profile);
            // A request older than 15 minutes is presumed lost (the server allows a retry after the same interval).
            const requestedRecently = profile.runRequestedAt !== null && mountedAt - new Date(profile.runRequestedAt).getTime() < 15 * 60 * 1000;
            const askedAt = queuedAt[profile.id];
            const lastRun = profile.lastRunAt ? new Date(profile.lastRunAt).getTime() : 0;
            const queued = (askedAt !== undefined && lastRun < askedAt) || requestedRecently;
            const liveRun = githubLive ? activeRunFor(runs, profile) : undefined;
            const criteria = criteriaSummary(profile.criteria);
            const enabledSources = (Object.keys(SOURCE_SHORT_LABELS) as (keyof ProfileSources)[]).filter((k) => profile.sources[k]);
            return (
              <TableRow key={profile.id} className="cursor-pointer md:h-[92px]" onClick={() => setEditing(profile)}>
                <TableCell mobileLabel="Profile" noWrapper>
                  <div className="min-w-0 text-right md:text-left">
                    <span className="flex items-center justify-end gap-2 md:justify-start">
                      <span className="truncate font-medium text-foreground">{profile.name}</span>
                      {!active && <span className="label-kicker shrink-0">Paused</span>}
                    </span>
                    <span className={cn("block truncate text-xs text-muted-foreground")}>
                      {[profile.category, ...profile.keywords].join(" · ")}
                    </span>
                    {criteria && <span className="block truncate text-xs text-muted-foreground">Looking for: {criteria}</span>}
                  </div>
                </TableCell>
                <TableCell mobileLabel="Area" className="text-muted-foreground">
                  {profile.city}, {profile.state} · {profile.radiusMiles} mi · {profile.locationScope === "radius" ? "in radius" : profile.locationScope === "state" ? "statewide" : "anywhere"}
                </TableCell>
                <TableCell mobileLabel="Sources" className="text-muted-foreground">
                  {enabledSources.map((k) => SOURCE_SHORT_LABELS[k]).join(", ") || "—"}
                </TableCell>
                <TableCell mobileLabel="Cap / frequency" className="text-muted-foreground">
                  {profile.maxLeadsPerRun} leads / {profile.frequencyHours}h
                </TableCell>
                <TableCell mobileLabel="Last run" className="text-muted-foreground">
                  {profile.lastRunAt ? formatDateUS(profile.lastRunAt, { month: "short", day: "numeric" }) : "Never"}
                </TableCell>
                <TableCell mobileLabel="Status" noWrapper={active} className="text-muted-foreground">
                  {active ? <NextRun profile={profile} queued={queued} liveRun={liveRun} githubLive={githubLive} /> : "Paused"}
                </TableCell>
                <TableCell hideBorderMobile className="md:justify-end">
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      loading={busyId === profile.id}
                      disabled={!active || queued || !!liveRun}
                      title={
                        !active
                          ? "Resume the profile to run it"
                          : liveRun?.status === "in_progress"
                            ? "This profile is running right now"
                            : queued || liveRun
                              ? "A run is already queued for this profile"
                              : "Run this profile now, outside its schedule"
                      }
                      onClick={() => runNow(profile)}
                    >
                      <Zap />
                      {liveRun?.status === "in_progress" ? "Running" : queued || liveRun ? "Queued" : "Run now"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === profile.id} onClick={() => toggleActive(profile)}>
                      {active ? <Pause /> : <Play />}
                      {active ? "Pause" : "Resume"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination slice={paged} onPageChange={setPage} noun="profiles" className="shrink-0" />
      </div>

      {vault}
    </div>
  );
}
