"use client";

import { motion, useReducedMotion } from "framer-motion";

interface TablePreviewDemoProps {
  /** Plain column labels, not a real table's actual columns — see `TourStep.demo` in `page-help.ts`. */
  columns: string[];
}

const CYCLE_SECONDS = 4.5;
const ROWS = 3;

/**
 * A small looping illustration of a populated table — fake header + a few rows that fade in one after another.
 * Used on a step that points at a table that might be empty right now, so a brand-new workspace still shows what
 * the list looks like once there's something in it. Purely decorative, like `VaultFillDemo`.
 */
export function TablePreviewDemo({ columns }: TablePreviewDemoProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-divider bg-surface-alt p-3">
      <div className="flex gap-3 border-b border-divider pb-1.5">
        {columns.slice(0, 4).map((column) => (
          <div key={column} className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {column}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-3">
            {columns.slice(0, 4).map((column, col) =>
              reduceMotion ? (
                <div key={column} className="h-2 min-w-0 flex-1 rounded-sm bg-muted-foreground/20" />
              ) : (
                <motion.div
                  key={column}
                  className="h-2 min-w-0 flex-1 rounded-sm bg-muted-foreground/20"
                  animate={{ opacity: [0, 0, 1, 1, 0] }}
                  transition={{
                    duration: CYCLE_SECONDS,
                    repeat: Infinity,
                    ease: "easeInOut",
                    // Rows appear one after another, left to right within a row, then everything resets together.
                    times: [0, 0.08 + row * 0.16 + col * 0.03, 0.22 + row * 0.16 + col * 0.03, 0.85, 1],
                  }}
                />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
