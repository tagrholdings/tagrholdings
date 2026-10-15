"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The bullet list inside an alert banner ("12 sites couldn't be read…"). Shows the first few and folds the rest
 * behind a "Show N more" button — a long list never takes over the screen, and there is no scrollbar inside the
 * banner (a nested scroller looked broken).
 */
export function FlaggedList({ items, limit = 3, className }: { items: { key: string; node: ReactNode }[]; limit?: number; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = items.length - limit;
  const shown = expanded || hidden <= 0 ? items : items.slice(0, limit);

  return (
    <div className={className}>
      <ul className="list-inside list-disc text-muted-foreground">
        {shown.map((item) => (
          <li key={item.key}>{item.node}</li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={cn("mt-1 text-xs font-medium underline-offset-4 hover:underline", "text-destructive")}
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
