"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Inbox, Loader2, Undo2, X, Plus } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { notify } from "@/components/ui/toaster";
import { formatDateUS } from "@/utils/date";
import { paginate } from "@/utils/pagination";
import { dismissRawLeadAction, promoteRawLeadAction, restoreRawLeadAction } from "@/modules/leads/leads.actions";
import { SOURCE_LABELS } from "@/modules/leads/leads.constants";
import type { RawLeadStatus } from "@/modules/leads/leads.schema";
import type { RawLeadSummary } from "@/modules/leads/leads.types";
import { FIT_RANK } from "@/modules/search-profiles/fit";
import { RawLeadDetailPanel } from "./RawLeadDetailPanel";
import { QuickAddLead } from "./QuickAddLead";
import { FitBadge } from "./FitBadge";
import { locationLine, text } from "./lead-fields";

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

// Leads per page: ~10 rows fill a screen, so reviewing the inbox never means a long scroll.
const PAGE_SIZE = 10;

export function RawLeadsView({
  leads,
  initialSelectedId,
  initialAdd,
}: {
  leads: RawLeadSummary[];
  initialSelectedId: string | null;
  /** Text pre-filled into the quick-add box (from the PWA share target: /leads-inbox?add=…). */
  initialAdd: string;
}) {
  const [filter, setFilter] = useState<RawLeadStatus>("new");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const tableTop = useRef<HTMLDivElement>(null);
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
  const goToPage = (next: number) => {
    setPage(next);
    // Land back at the top of the table, not wherever the Next button was.
    tableTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const query = search.trim().toLowerCase();
  const visible = leads
    .filter((lead) => statusOf(lead) === filter)
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
  const paged = paginate(visible, page, PAGE_SIZE);

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
        {quickAdd}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No discovered leads yet</EmptyTitle>
            <EmptyDescription>
              The lead engine searches on a schedule using your search profiles and drops what it finds here for review. You can also add one by hand above.
            </EmptyDescription>
          </EmptyHeader>
          <Button render={<Link href="/leads-inbox/profiles" />}>
            <Plus />
            Set up a search profile
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    // Flex row so the detail panel pushes the table instead of overlaying it — see side-panel.tsx.
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {quickAdd}
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 bg-background pb-4 pt-2">
          <SegmentedControl
            value={filter}
            onChange={changeFilter}
            options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts[f.value] + (f.value === "new" ? pending.length : 0)}` }))}
          />
          <SearchInput
            placeholder="Filter by name, industry or city"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9"
            containerClassName="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs"
          />
          {hasFit && (
            <SegmentedControl
              value={sort}
              onChange={changeSort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "fit", label: "Best fit" },
              ]}
            />
          )}
        </div>

        {visible.length === 0 && !(filter === "new" && pending.length > 0) ? (
          <Empty>
            <EmptyTitle className="text-sm">{query ? `No leads match “${search}”` : EMPTY_COPY[filter]}</EmptyTitle>
          </Empty>
        ) : (
          <div ref={tableTop} className="flex scroll-mt-32 flex-col gap-4">
          <Table>
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
                  <TableRow key={p.key} aria-busy="true">
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
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedId(lead.id)}>
                    <TableCell mobileLabel="Business" noWrapper>
                      <div className="min-w-0 text-right md:text-left">
                        <span className="block truncate font-medium text-foreground">{lead.businessName}</span>
                        {text(fields.industry) && (
                          <span className="block truncate text-xs text-muted-foreground">{text(fields.industry)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell mobileLabel="Location" className="text-muted-foreground">
                      {locationLine(fields) ?? "—"}
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
          <Pagination slice={paged} onPageChange={goToPage} noun="leads" />
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
