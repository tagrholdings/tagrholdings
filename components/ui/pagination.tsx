import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageSlice } from "@/utils/pagination";

/**
 * Previous / Next controls under a table, with "Showing 11–20 of 34". Renders nothing when everything fits on
 * one page, so a short list stays clean. Pair with `paginate()` (utils/pagination.ts), which does the slicing
 * and hands this the `page` to show.
 */
export function Pagination({
  slice,
  onPageChange,
  noun = "results",
  className,
}: {
  slice: Pick<PageSlice<unknown>, "page" | "pageCount" | "total" | "from" | "to">;
  onPageChange: (page: number) => void;
  /** Plural noun for the range text: "Showing 1–10 of 34 leads". */
  noun?: string;
  className?: string;
}) {
  const { page, pageCount, total, from, to } = slice;
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className={cn("flex flex-col items-center gap-3 sm:flex-row sm:justify-between", className)}>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium tabular-nums text-foreground">{from}–{to}</span> of{" "}
        <span className="font-medium tabular-nums text-foreground">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          Previous
        </Button>
        <span className="min-w-20 text-center text-sm tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
