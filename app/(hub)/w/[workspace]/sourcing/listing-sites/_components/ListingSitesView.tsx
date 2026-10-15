"use client";

import { useState } from "react";
import { AlertTriangle, Building2, EyeOff, Plus, RotateCcw } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageSlotContent, MOBILE_GHOST } from "@/components/layout/page-slots";
import { Pagination } from "@/components/ui/pagination";
import { useFitPageSize } from "@/hooks/ui/use-fit-page-size";
import { paginate } from "@/utils/pagination";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { httpUrl } from "../../_components/lead-fields";
import { FlaggedList } from "../../_components/FlaggedList";
import { setListingSiteActiveAction } from "@/modules/listing-sites/listing-sites.actions";
import { needsManualCheck, type ListingSiteSummary } from "@/modules/listing-sites/listing-sites.types";
import { explainSiteStatus } from "@/modules/listing-sites/site-status";
import { ListingSiteVault } from "./ListingSiteVault";
import { SiteStatusVault } from "./SiteStatusVault";

const TONE_CLASSES = {
  good: "border-accent bg-accent/15 text-foreground",
  warn: "border-divider bg-surface-alt text-foreground",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  neutral: "border-divider bg-transparent text-muted-foreground",
} as const;

// Table geometry for the one-screen page (see useFitPageSize): a row is up to three lines tall.
const ROW_HEIGHT = 92;
const RESERVED_HEIGHT = 104;

export function ListingSitesView({ sites }: { sites: ListingSiteSummary[] }) {
  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { ref: fitRef, pageSize } = useFitPageSize({ rowHeight: ROW_HEIGHT, reserved: RESERVED_HEIGHT });

  async function setActive(site: ListingSiteSummary, active: boolean) {
    setBusyId(site.id);
    try {
      const result = await setListingSiteActiveAction({ id: site.id, active });
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? "Couldn't update that site.");
        return;
      }
      notify.success(active ? "The engine will read this site again." : "Ignored — the engine won't read or re-add this site.");
    } finally {
      setBusyId(null);
    }
  }

  const addButton = (
    <PageSlotContent name="tabs">
      <Button data-tour="listing-sites-add" className={MOBILE_GHOST} onClick={() => setAdding(true)}>
        <Plus />
        <span className="hidden sm:inline">Add site</span>
      </Button>
    </PageSlotContent>
  );
  const vault = <ListingSiteVault open={adding} onOpenChange={setAdding} />;
  const detailSite = sites.find((s) => s.id === detailId) ?? null;
  const detailVault = (
    <SiteStatusVault
      site={detailSite}
      busy={busyId === detailId}
      onOpenChange={(open) => !open && setDetailId(null)}
      onAddSite={() => {
        setDetailId(null);
        setAdding(true);
      }}
      onIgnore={async (site) => {
        await setActive(site, false);
        setDetailId(null);
      }}
    />
  );

  const blocked = sites.filter(needsManualCheck);
  const banner =
    blocked.length > 0 ? (
      <div role="alert" data-tour="listing-sites-flagged" className="flex shrink-0 items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-destructive">
            {blocked.length === 1 ? "1 site doesn’t let the engine in — open it yourself" : `${blocked.length} sites don’t let the engine in — open them yourself`}
          </p>
          <FlaggedList
            className="mt-2"
            items={blocked.map((s) => ({
              key: s.id,
              node: (
                <>
                  <span className="font-medium text-foreground">{s.siteName}</span>
                  {` — ${explainSiteStatus(s.status, s.statusDetail).short}`}
                </>
              ),
            }))}
          />
        </div>
      </div>
    ) : null;

  if (sites.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Empty data-tour="listing-sites-table">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No listing sites yet</EmptyTitle>
            <EmptyDescription>
              Turn on Broker listing sites in a search profile and the engine will find brokers for its industries — or add a broker&rsquo;s website yourself.
            </EmptyDescription>
          </EmptyHeader>
          {addButton}
        </Empty>
        {vault}
      </div>
    );
  }

  const paged = paginate(sites, page, pageSize);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {banner}
      <div className="flex shrink-0 justify-end empty:hidden">{addButton}</div>

      <div ref={fitRef} className="flex min-h-0 flex-1 flex-col gap-4 md:overflow-hidden">
      <Table data-tour="listing-sites-table" className="md:min-h-0 md:overflow-y-auto">
        <TableHeader>
          <tr>
            <TableHead>Site</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last read</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {paged.items.map((site) => {
            const { label, tone, short } = explainSiteStatus(site.status, site.statusDetail);
            const url = httpUrl(site.listingsUrl ?? site.siteUrl);
            const flagged = needsManualCheck(site);
            return (
              <TableRow key={site.id} className={cn("md:h-[92px]", !site.active && "opacity-60")}>
                <TableCell mobileLabel="Site" noWrapper>
                  <div className="min-w-0 text-right md:text-left">
                    <span className="block truncate font-medium text-foreground">{site.siteName}</span>
                    <span className="block text-xs text-muted-foreground">{site.source === "auto_detected" ? "Found by the engine" : "Added by hand"}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-accent-text hover:text-accent-hover">
                        {url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell mobileLabel="Status" noWrapper>
                  <div className="min-w-0 text-right md:text-left">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium",
                        TONE_CLASSES[!site.active ? "neutral" : tone]
                      )}
                    >
                      {site.active ? label : "Ignored"}
                    </span>
                    {site.active && site.status === "ok" && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {site.lastListingCount} listing{site.lastListingCount === 1 ? "" : "s"} for your industries
                      </span>
                    )}
                    {short && site.active && site.status !== "ok" && (
                      <button
                        type="button"
                        onClick={() => setDetailId(site.id)}
                        aria-label={`What happened with ${site.siteName}?`}
                        className={cn(
                          "mt-1 block max-w-sm text-left text-xs underline-offset-2 hover:underline",
                          flagged ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        <span className="line-clamp-2">{short}</span>
                        <span className="font-medium">See details →</span>
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell mobileLabel="Last read">
                  <span className="text-sm text-muted-foreground">
                    {site.lastCrawledAt ? formatDateUS(site.lastCrawledAt, { month: "short", day: "numeric" }) : "—"}
                  </span>
                </TableCell>
                <TableCell hideBorderMobile className="md:justify-end">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {flagged && url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Open site
                      </a>
                    )}
                    {site.active ? (
                      <Button size="sm" variant="outline" loading={busyId === site.id} onClick={() => setActive(site, false)}>
                        <EyeOff />
                        Ignore
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" loading={busyId === site.id} onClick={() => setActive(site, true)}>
                        <RotateCcw />
                        Use again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination slice={paged} onPageChange={setPage} noun="sites" className="shrink-0" />
      </div>
      {vault}
      {detailVault}
    </div>
  );
}
