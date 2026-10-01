"use client";

import { motion, useReducedMotion } from "framer-motion";

interface BoardPreviewDemoProps {
  /** Plain stage labels, not a real board's actual columns — see `TourStep.demo` in `page-help.ts`. */
  columns: string[];
}

const CYCLE_SECONDS = 4.5;

function Card({ wide }: { wide?: boolean }) {
  return (
    <div className="space-y-1 rounded border border-divider bg-surface p-1.5">
      <div className={`h-1.5 rounded-sm bg-muted-foreground/30 ${wide ? "w-full" : "w-2/3"}`} />
      <div className="h-1.5 w-1/3 rounded-sm bg-muted-foreground/20" />
    </div>
  );
}

/**
 * A small looping illustration of a populated kanban board — fake columns, each with a couple of cards that fade
 * in. Used on a step that points at a board that might be empty right now, so a brand-new workspace still shows
 * what the board looks like with leads/items on it. Purely decorative, like `VaultFillDemo`.
 */
export function BoardPreviewDemo({ columns }: BoardPreviewDemoProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-divider bg-surface-alt p-3">
      <div className="grid grid-cols-3 gap-2">
        {columns.slice(0, 3).map((column, i) => (
          <div key={column} className="min-w-0 space-y-1.5">
            <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{column}</div>
            <div className="space-y-1.5">
              {reduceMotion ? (
                <>
                  <Card wide={i === 0} />
                  {i !== 2 && <Card />}
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ opacity: [0, 0, 1, 1, 0], y: [4, 4, 0, 0, 4] }}
                    transition={{
                      duration: CYCLE_SECONDS,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.1 + i * 0.12, 0.3 + i * 0.12, 0.8, 1],
                    }}
                  >
                    <Card wide={i === 0} />
                  </motion.div>
                  {i !== 2 && (
                    <motion.div
                      animate={{ opacity: [0, 0, 1, 1, 0], y: [4, 4, 0, 0, 4] }}
                      transition={{
                        duration: CYCLE_SECONDS,
                        repeat: Infinity,
                        ease: "easeInOut",
                        times: [0, 0.22 + i * 0.12, 0.42 + i * 0.12, 0.8, 1],
                      }}
                    >
                      <Card />
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
