"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn, initialsFor } from "@/lib/utils";
import { columnDotClassName } from "@/modules/pipeline/pipeline.constants";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { ActivityProgressBadge } from "./ActivityProgressBadge";
import type { ActivityProgress, PipelineItemRow, BoardColumn } from "./types";

export function PipelineListView({
  columns,
  items,
  progressByItem,
  onSelect,
  stickyTopRem = 6.5,
}: {
  columns: BoardColumn[];
  items: PipelineItemRow[];
  progressByItem: Record<string, ActivityProgress>;
  onSelect: (id: string) => void;
  /** Where (rem) this pill row sticks on mobile, right under the header (and, on /projects, the project tabs). See PipelineView. */
  stickyTopRem?: number;
}) {
  const [stageFilter, setStageFilter] = useState<string | "all">("all");
  const filtered = stageFilter === "all" ? items : items.filter((item) => item.stage === stageFilter);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Horizontal scroll, not wrap — a board can have up to 10 stages, and wrapping that many pills to several
          lines on mobile pushed the actual list below the fold. Sticky (mobile only) so the filter stays reachable
          while scrolling a long list, right under PipelineView's own sticky toolbar. */}
      <div
        className="no-scrollbar sticky z-10 flex gap-2 overflow-x-auto bg-background py-2 md:static md:bg-transparent md:py-0 md:pb-0.5"
        style={{ top: `${stickyTopRem}rem` }}
      >
        {[{ id: "all", label: "All" }, ...columns].map((column) => (
          <button
            key={column.id}
            type="button"
            onClick={() => setStageFilter(column.id)}
            className={cn(
              "shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              stageFilter === column.id
                ? "border-accent bg-accent text-ink"
                : "border-divider bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {column.label}
            <span className="ml-1.5 opacity-70">
              {column.id === "all" ? items.length : items.filter((item) => item.stage === column.id).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyTitle className="text-sm">No items in this stage</EmptyTitle>
        </Empty>
      ) : (
        <>
          {/* Desktop: the full table, one column per field. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Title</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Activities</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const columnIndex = columns.findIndex((c) => c.id === item.stage);
                  const progress = progressByItem[item.id];
                  const isOptimistic = item.id.startsWith("optimistic-");
                  return (
                    <TableRow
                      key={item.id}
                      className={cn("cursor-pointer", isOptimistic && "pointer-events-none opacity-60")}
                      onClick={() => onSelect(item.id)}
                    >
                      <TableCell mobileLabel="Title">
                        <span className="font-medium text-foreground">{item.title}</span>
                      </TableCell>
                      <TableCell mobileLabel="Organization" className="text-muted-foreground">
                        {item.organizationName ? (
                          <>
                            <Building2 className="size-3.5 shrink-0" />
                            {item.organizationName}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell mobileLabel="Contact" className="text-muted-foreground">
                        {item.contactName ? (
                          <>
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold text-foreground">
                              {initialsFor(item.contactName)}
                            </span>
                            {item.contactName}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell mobileLabel="Stage">
                        {columnIndex >= 0 && <span className={cn("size-2 shrink-0 rounded-full", columnDotClassName(columnIndex))} />}
                        <span className="text-foreground">{columns[columnIndex]?.label ?? item.stage}</span>
                      </TableCell>
                      <TableCell mobileLabel="Activities" className="text-muted-foreground">
                        {progress && progress.total > 0 ? <ActivityProgressBadge progress={progress} /> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/*
            Mobile: a denser single-row card instead of the table's 5 stacked label/value lines — stage dot +
            label, title + organization/contact on one line each, activities badge trailing. Roughly half the
            height per item versus the generic `Table` mobile layout, which matters more here since the list is
            the default mobile view (see design.md).
          */}
          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.map((item) => {
              const columnIndex = columns.findIndex((c) => c.id === item.stage);
              const progress = progressByItem[item.id];
              const isOptimistic = item.id.startsWith("optimistic-");
              const subtitle = [item.organizationName, item.contactName].filter(Boolean).join(" · ");
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-divider bg-surface px-4 py-3 text-left transition-colors active:bg-surface-alt/70",
                      isOptimistic && "pointer-events-none opacity-60"
                    )}
                  >
                    {columnIndex >= 0 && <span className={cn("size-2.5 shrink-0 rounded-full", columnDotClassName(columnIndex))} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{item.title}</p>
                      {/* Falls back to the stage label when there's no org/contact, so it's never shown twice
                          next to the activities badge. */}
                      <p className="truncate text-xs text-muted-foreground">{subtitle || columns[columnIndex]?.label || item.stage}</p>
                    </div>
                    <ActivityProgressBadge progress={progress} className="shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
