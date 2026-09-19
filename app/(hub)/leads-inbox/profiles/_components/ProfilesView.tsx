"use client";

import { useState } from "react";
import { Pause, Play, Plus, Radar, Zap } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { runSearchProfileNowAction, updateSearchProfileAction } from "@/modules/search-profiles/search-profiles.actions";
import { formatUsdCompact } from "@/modules/search-profiles/fit";
import type { ProfileSources, QualificationCriteria } from "@/modules/search-profiles/search-profiles.schema";
import type { SearchProfileSummary } from "@/modules/search-profiles/search-profiles.types";
import { SearchProfileVault } from "./SearchProfileVault";

const SOURCE_SHORT_LABELS: Record<keyof ProfileSources, string> = {
  google_places: "Places",
  brave_search: "Brave",
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

export function ProfilesView({ profiles }: { profiles: SearchProfileSummary[] }) {
  // undefined = closed, null = creating, profile = editing.
  const [editing, setEditing] = useState<SearchProfileSummary | null | undefined>(undefined);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Profiles whose "Run now" was queued in this session — the row flips to "Queued" before the server list refreshes.
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  // "Now" for judging how old a queued request is — read once on mount (render must stay pure); good enough for a 15-minute window.
  const [mountedAt] = useState(() => Date.now());

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
      setQueuedIds((prev) => new Set(prev).add(profile.id));
      if (result.data.dispatch === "dispatched") notify.success("Run started — new leads will appear in the inbox in a few minutes.", 6000);
      else notify.info("Run queued. It starts with the engine's next scheduled run (the CRM can't start it instantly until GitHub is connected).", 8000);
    } finally {
      setBusyId(null);
    }
  }

  const createButton = (
    <Button onClick={() => setEditing(null)}>
      <Plus />
      New profile
    </Button>
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
        <Empty>
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
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">{createButton}</div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Profile</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead>Cap / frequency</TableHead>
            <TableHead>Last run</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => {
            const active = isActive(profile);
            // A request older than 15 minutes is presumed lost (the server allows a retry after the same interval).
            const requestedRecently = profile.runRequestedAt !== null && mountedAt - new Date(profile.runRequestedAt).getTime() < 15 * 60 * 1000;
            const queued = queuedIds.has(profile.id) || requestedRecently;
            const criteria = criteriaSummary(profile.criteria);
            const enabledSources = (Object.keys(SOURCE_SHORT_LABELS) as (keyof ProfileSources)[]).filter((k) => profile.sources[k]);
            return (
              <TableRow key={profile.id} className="cursor-pointer" onClick={() => setEditing(profile)}>
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
                  {profile.city}, {profile.state} · {profile.radiusMiles} mi
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
                <TableCell hideBorderMobile className="md:justify-end">
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      loading={busyId === profile.id}
                      disabled={!active || queued}
                      title={!active ? "Resume the profile to run it" : queued ? "A run is already queued for this profile" : "Run this profile now, outside its schedule"}
                      onClick={() => runNow(profile)}
                    >
                      <Zap />
                      {queued ? "Queued" : "Run now"}
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

      {vault}
    </div>
  );
}
