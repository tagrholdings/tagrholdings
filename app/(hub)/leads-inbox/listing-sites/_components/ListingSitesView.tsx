"use client";

import { useState } from "react";
import { AlertTriangle, Building2, EyeOff, Plus, RotateCcw } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button, buttonVariants } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { httpUrl } from "../../_components/lead-fields";
import { setListingSiteActiveAction } from "@/modules/listing-sites/listing-sites.actions";
import { needsManualCheck, type ListingSiteSummary } from "@/modules/listing-sites/listing-sites.types";
import type { ListingSiteStatus } from "@/modules/listing-sites/listing-sites.schema";
import { ListingSiteVault } from "./ListingSiteVault";

const STATUS_LABELS: Record<ListingSiteStatus, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  pending: { label: "Not read yet", tone: "neutral" },
  ok: { label: "Read", tone: "good" },
  no_listings: { label: "No matching listings", tone: "neutral" },
  blocked: { label: "Blocked — check by hand", tone: "bad" },
  error: { label: "Couldn't read — check by hand", tone: "bad" },
};

const TONE_CLASSES = {
  good: "border-accent bg-accent/15 text-foreground",
  warn: "border-divider bg-surface-alt text-foreground",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  neutral: "border-divider bg-transparent text-muted-foreground",
} as const;

export function ListingSitesView({ sites }: { sites: ListingSiteSummary[] }) {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <Button onClick={() => setAdding(true)}>
      <Plus />
      Add site
    </Button>
  );
  const vault = <ListingSiteVault open={adding} onOpenChange={setAdding} />;

  const intro = (
    <div className="rounded-lg border border-divider bg-surface p-4 text-sm text-muted-foreground">
      <p>
        These are the <strong className="text-foreground">business brokers</strong> the engine reads for businesses that are for sale. It finds them on its own
        (about once a week, using the industries in your search profiles and the state) and opens each one&rsquo;s &ldquo;buy a business&rdquo; pages, the way you
        would by hand. You can add one yourself, or ignore one you don&rsquo;t want.
      </p>
      <p className="mt-2">
        A site that refuses automated visits is never forced open: it is flagged here so you can check it by hand — and if it has an email list for new listings,
        add it under Email sources so those emails reach the inbox.
      </p>
    </div>
  );

  const blocked = sites.filter(needsManualCheck);
  const banner =
    blocked.length > 0 ? (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-destructive">
            {blocked.length === 1 ? "1 site couldn’t be read by the engine — check it by hand" : `${blocked.length} sites couldn’t be read by the engine — check them by hand`}
          </p>
          <ul className="mt-2 list-inside list-disc text-muted-foreground">
            {blocked.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-foreground">{s.siteName}</span>
                {s.statusDetail ? ` — ${s.statusDetail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  if (sites.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {intro}
        <Empty>
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

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {banner}
      {intro}
      <div className="flex justify-end">{addButton}</div>

      <Table>
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
          {sites.map((site) => {
            const { label, tone } = STATUS_LABELS[site.status];
            const url = httpUrl(site.listingsUrl ?? site.siteUrl);
            const flagged = needsManualCheck(site);
            return (
              <TableRow key={site.id} className={cn(!site.active && "opacity-60")}>
                <TableCell mobileLabel="Site" noWrapper>
                  <div className="min-w-0 text-right md:text-left">
                    <span className="block truncate font-medium text-foreground">{site.siteName}</span>
                    <span className="block text-xs text-muted-foreground">{site.source === "auto_detected" ? "Found by the engine" : "Added by hand"}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-accent hover:text-accent-hover">
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
                    {site.statusDetail && site.active && site.status !== "ok" && (
                      <span className={cn("mt-1 block max-w-xs text-xs md:truncate", flagged ? "text-destructive" : "text-muted-foreground")} title={site.statusDetail}>
                        {site.statusDetail}
                      </span>
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
      {vault}
    </div>
  );
}
