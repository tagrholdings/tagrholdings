"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Inbox, Loader2, Undo2, X, Plus, ArrowUpDown, CalendarClock } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SearchInput } from "@/components/ui/search-input";
import { useHeaderSearch } from "@/components/layout/header-search";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { notify } from "@/components/ui/toaster";
import { formatDateUS } from "@/utils/date";
import { paginate } from "@/utils/pagination";
import { dismissRawLeadAction, promoteRawLeadAction, restoreRawLeadAction } from "@/modules/leads/leads.actions";
import { SOURCE_LABELS } from "@/modules/leads/leads.constants";
import type { RawLeadStatus } from "@/modules/leads/leads.schema";
import type { RawLeadSummary } from "@/modules/leads/leads.types";
import { FIT_RANK } from "@/modules/search-profiles/fit";
import { useFitPageSize } from "@/hooks/ui/use-fit-page-size";
import { RawLeadDetailPanel } from "./RawLeadDetailPanel";
import { QuickAddLead } from "./QuickAddLead";
import { FitBadge } from "./FitBadge";
import { LocationBadge } from "./LocationBadge";
import { locationLine, text } from "./lead-fields";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";

const FILTERS: { value: RawLeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "processed", label: "Added" },
  { value: "dismissed", label: "Dismissed" },
];

const EMPTY_COPY: Record<RawLeadStatus, string> = {
  new: "You're all caught up — no leads waiting for review.",
  processed: "Leads you add to the pipeline will be listed here.",
  dismissed: "Dismissed leads are archived here, never deleted.",
};

type Sort = "newest" | "fit";

/** When a lead was found: any time, or within a recent window (compared with the "Found" column's date). */
type FoundRange = "any" | "today" | "7d" | "30d";
const FOUND_OPTIONS: { value: FoundRange; label: string }[] = [
  { value: "any", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

/** Earliest "found" time (epoch ms) a lead may have to pass the range, or null for no limit. "Today" = since local midnight. */
function foundCutoff(range: FoundRange, now: number): number | null {
  const day = 24 * 60 * 60 * 1000;
  if (range === "today") return new Date(now).setHours(0, 0, 0, 0);
  if (range === "7d") return now - 7 * day;
  if (range === "30d") return now - 30 * day;
  return null;
}

// Table geometry, so the page can hold exactly as many rows as fit on one screen (no page scroll on desktop).
const ROW_HEIGHT = 68; // matches the row's md:h-[68px]
const RESERVED_HEIGHT = 104; // table header + pagination + the gap between them

export function RawLeadsView({
  leads,
  initialSelectedId,
  initialAdd,
}: {
  leads: RawLeadSummary[];
  initialSelectedId: string | null;
  /** Text pre-filled into the Add lead Vault, which opens with it (from the PWA share target: /leads-inbox?add=…). */
  initialAdd: string;
}) {
  const path = useWorkspacePath();
  const [filter, setFilter] = useState<RawLeadStatus>("new");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [found, setFound] = useState<FoundRange>("any");
  // "Now" for the Found filter — read once on mount (render must stay pure); a window of days doesn't need to tick.
  const [mountedAt] = useState(() => Date.now());
  // The space the table gets decides how many rows a page holds (see HubPage fitViewport).
  const { ref: fitRef, element: fitElement, pageSize } = useFitPageSize({ rowHeight: ROW_HEIGHT, reserved: RESERVED_HEIGHT });
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  // Leads handled in this session flip immediately, before the revalidated
  // server list arrives; `pipelineItemId` is filled in by the server list.
  const [handled, setHandled] = useState<Record<string, RawLeadStatus>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Quick-adds still being read/extracted: shown as a row right away, replaced by the real lead when the server list refreshes.
  const [pending, setPending] = useState<{ key: string; label: string }[]>([]);

  const statusOf = (lead: RawLeadSummary) => handled[lead.id] ?? lead.status;
  const hasFit = leads.some((l) => l.fit !== null);

  const counts = useMemo(() => {
    const result: Record<RawLeadStatus, number> = { new: 0, processed: 0, dismissed: 0 };
    for (const lead of leads) result[handled[lead.id] ?? lead.status] += 1;
    return result;
  }, [leads, handled]);

  async function run(id: string, action: () => Promise<{ serverError?: string; validationErrors?: unknown } | undefined>, next: RawLeadStatus, success: string, failure: string) {
    setBusyId(id);
    try {
      const result = await action();
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? failure);
        return;
      }
      setHandled((prev) => ({ ...prev, [id]: next }));
      notify.success(success);
    } finally {
      setBusyId(null);
    }
  }

  const promote = (id: string) =>
    run(id, () => promoteRawLeadAction({ id }), "processed", "Added to Leads.", "Couldn't add that lead. Please try again.");
  const dismiss = (id: string) =>
    run(id, () => dismissRawLeadAction({ id }), "dismissed", "Lead dismissed.", "Couldn't dismiss that lead. Please try again.");
  const restore = (id: string) =>
    run(id, () => restoreRawLeadAction({ id }), "new", "Lead restored to the inbox.", "Couldn't restore that lead. Please try again.");

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  // Changing what's listed (tab, search, sort) starts over at page 1.
  const changeFilter = (value: RawLeadStatus) => {
    setFilter(value);
    setPage(1);
  };
  const changeSort = (value: Sort) => {
    setSort(value);
    setPage(1);
  };
  const changeFound = (value: FoundRange) => {
    setFound(value);
    setPage(1);
  };
  const goToPage = (next: number) => {
    setPage(next);
    // On a phone the page scrolls: land back at the top of the table, not wherever the Next button was.
    fitElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // On phones this same filter lives in the header (see header-search.tsx).
  useHeaderSearch({
    placeholder: "Filter by name, industry or city",
    value: search,
    onChange: (value) => {
      setSearch(value);
      setPage(1);
    },
    // There's an empty-state return below this hook — no leads, nothing to filter.
    enabled: leads.length > 0 || pending.length > 0,
  });

  const query = search.trim().toLowerCase();
  const cutoff = foundCutoff(found, mountedAt);
  const visible = leads
    .filter((lead) => statusOf(lead) === filter)
    .filter((lead) => cutoff === null || +new Date(lead.createdAt) >= cutoff)
    .filter((lead) => {
      if (!query) return true;
      const fields = lead.extractedFields ?? {};
      return (
        lead.businessName.toLowerCase().includes(query) ||
        (text(fields.industry)?.toLowerCase().includes(query) ?? false) ||
        (locationLine(fields)?.toLowerCase().includes(query) ?? false)
      );
    })
    .sort((a, b) =>
      sort === "fit" ? FIT_RANK[a.fit?.status ?? "none"] - FIT_RANK[b.fit?.status ?? "none"] || +new Date(b.createdAt) - +new Date(a.createdAt) : 0
    );

  // `page` is clamped, so dismissing the last lead on the last page just shows the new last page.
  const paged = paginate(visible, page, pageSize);

  const quickAdd = (
    <QuickAddLead
      initialValue={initialAdd}
      onStart={(key, label) => {
        changeFilter("new"); // the pending row sits at the top of page 1 of New
        setPending((prev) => [{ key, label }, ...prev]);
      }}
      onFinish={(key) => setPending((prev) => prev.filter((p) => p.key !== key))}
    />
  );

  if (leads.length === 0 && pending.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex">{quickAdd}</div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No discovered leads yet</EmptyTitle>
            <EmptyDescription>
              The lead engine searches on a schedule using your search profiles and drops what it finds here for review. You can also add one by hand with “Add lead”.
            </EmptyDescription>
          </EmptyHeader>
          <Button render={<Link href={path("/leads-inbox/profiles")} />}>
            <Plus />
            Set up a search profile
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    // Flex row so the detail panel pushes the table instead of overlaying it — see side-panel.tsx.
    <div className="flex min-h-0 min-w-0 flex-1 gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {/*
          Sticky only where the page scrolls (phones); on desktop the page is one screen tall. On mobile this
          stacks under the sticky `LeadsInboxTabs` strip (header 3.5rem + tabs row ~3.25rem), and the row itself
          scrolls sideways instead of wrapping to several lines — Sort/Found are compact dropdown buttons (the
          same `DropdownMenu` that already renders as a bottom-sheet Vault on mobile) rather than full segmented
          bars, so the whole toolbar fits in one line on a phone.
        */}
        <div
          data-tour="leads-inbox-filters"
          className="sticky top-[6.75rem] z-10 flex shrink-0 items-center gap-2 overflow-x-auto no-scrollbar bg-background pb-4 pt-2 md:static md:flex-wrap md:overflow-visible md:pb-0 md:pt-0"
        >
          <SegmentedControl
            value={filter}
            onChange={changeFilter}
            options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts[f.value] + (f.value === "new" ? pending.length : 0)}` }))}
          />
          {quickAdd}
          <SearchInput
            placeholder="Filter by name, industry or city"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9"
            containerClassName="hidden min-w-0 md:block md:w-auto md:flex-1 md:max-w-xs"
          />
          {hasFit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <ArrowUpDown />
                  {sort === "fit" ? "Best fit" : "Newest"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={sort} onValueChange={(value) => changeSort(value as Sort)}>
                  <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="fit">Best fit</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9" aria-label="Filter by when the lead was found">
                <CalendarClock />
                {FOUND_OPTIONS.find((o) => o.value === found)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={found} onValueChange={(value) => changeFound(value as FoundRange)}>
                {FOUND_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {visible.length === 0 && !(filter === "new" && pending.length > 0) ? (
          <Empty>
            <EmptyTitle className="text-sm">{query || cutoff !== null ? "No leads match these filters" : EMPTY_COPY[filter]}</EmptyTitle>
          </Empty>
        ) : (
          <div ref={fitRef} data-tour="leads-inbox-table" className="flex min-h-0 flex-1 scroll-mt-32 flex-col gap-4 md:overflow-hidden">
          <Table className="md:min-h-0 md:overflow-y-auto">
            <TableHeader>
              <tr>
                <TableHead>Business</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Asking / Revenue</TableHead>
                {hasFit && <TableHead>Fit</TableHead>}
                <TableHead>Found</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filter === "new" && paged.page === 1 &&
                pending.map((p) => (
                  <TableRow key={p.key} aria-busy="true" className="md:h-[68px]">
                    <TableCell mobileLabel="Business" noWrapper>
                      <div className="flex min-w-0 items-center gap-2 text-right md:text-left">
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{p.label}</span>
                          <span className="block text-xs text-muted-foreground">Reading and extracting details…</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell mobileLabel="Location" className="text-muted-foreground">—</TableCell>
                    <TableCell mobileLabel="Source" className="text-muted-foreground">Added by hand</TableCell>
                    <TableCell mobileLabel="Asking / Revenue" className="text-muted-foreground">—</TableCell>
                    {hasFit && <TableCell mobileLabel="Fit" className="text-muted-foreground">—</TableCell>}
                    <TableCell mobileLabel="Found" className="text-muted-foreground">Now</TableCell>
                    <TableCell hideBorderMobile>{null}</TableCell>
                  </TableRow>
                ))}
              {paged.items.map((lead) => {
                const fields = lead.extractedFields ?? {};
                const status = statusOf(lead);
                const numbers = [text(fields.askingPrice), text(fields.estimatedRevenue)].filter(Boolean).join(" / ");
                return (
                  <TableRow key={lead.id} className="cursor-pointer md:h-[68px]" onClick={() => setSelectedId(lead.id)}>
                    <TableCell mobileLabel="Business" noWrapper>
                      <div className="min-w-0 text-right md:text-left">
                        <span className="block truncate font-medium text-foreground">{lead.businessName}</span>
                        {text(fields.industry) && (
                          <span className="block truncate text-xs text-muted-foreground">{text(fields.industry)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell mobileLabel="Location" className="text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{locationLine(fields) ?? "—"}</span>
                        <LocationBadge match={fields.locationMatch} />
                      </div>
                    </TableCell>
                    <TableCell mobileLabel="Source" className="text-muted-foreground">
                      {SOURCE_LABELS[lead.sourceType] ?? lead.sourceType}
                    </TableCell>
                    <TableCell mobileLabel="Asking / Revenue" className="text-muted-foreground">
                      {numbers || "—"}
                    </TableCell>
                    {hasFit && (
                      <TableCell mobileLabel="Fit">{lead.fit ? <FitBadge status={lead.fit.status} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    )}
                    <TableCell mobileLabel="Found" className="text-muted-foreground">
                      {formatDateUS(lead.createdAt, { month: "short", day: "numeric" })}
                    </TableCell>
                    <TableCell hideBorderMobile className="md:justify-end">
                      {/* stopPropagation: the row itself opens the detail panel. */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {status === "new" && (
                          <>
                            <Button size="sm" loading={busyId === lead.id} onClick={() => promote(lead.id)}>
                              Add to pipeline
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Dismiss ${lead.businessName}`}
                              disabled={busyId === lead.id}
                              onClick={() => dismiss(lead.id)}
                            >
                              <X />
                            </Button>
                          </>
                        )}
                        {status === "dismissed" && (
                          <Button size="sm" variant="outline" loading={busyId === lead.id} onClick={() => restore(lead.id)}>
                            <Undo2 />
                            Restore
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination slice={paged} onPageChange={goToPage} noun="leads" className="shrink-0" />
          </div>
        )}
      </div>

      <RawLeadDetailPanel
        lead={selected}
        status={selected ? statusOf(selected) : null}
        busy={selected !== null && busyId === selected.id}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onPromote={promote}
        onDismiss={dismiss}
        onRestore={restore}
      />
    </div>
  );
}
