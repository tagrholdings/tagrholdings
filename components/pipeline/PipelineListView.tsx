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
}: {
  columns: BoardColumn[];
  items: PipelineItemRow[];
  progressByItem: Record<string, ActivityProgress>;
  onSelect: (id: string) => void;
}) {
  const [stageFilter, setStageFilter] = useState<string | "all">("all");
  const filtered = stageFilter === "all" ? items : items.filter((item) => item.stage === stageFilter);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Horizontal scroll, not wrap — a board can have up to 10 stages,
          and wrapping that many pills to several lines on mobile pushed the
          actual list below the fold. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
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
      )}
    </div>
  );
}
