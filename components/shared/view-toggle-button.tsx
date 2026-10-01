"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The phone-header version of the board/list switch: one icon button showing the view you'd switch TO, because the
 * two-segment `SegmentedControl` doesn't fit in a header that already holds the title, help, search and avatar.
 * The icon turns and cross-fades into the other one on each press.
 */
export function ViewToggleButton({
  value,
  onChange,
  tourId,
  className,
}: {
  value: "board" | "list";
  onChange: (value: "board" | "list") => void;
  /** `data-tour` name, so a guided tour can point at this control (see components/layout/page-help.ts). */
  tourId?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const next = value === "board" ? "list" : "board";
  const Icon = next === "list" ? List : LayoutGrid;

  return (
    <button
      type="button"
      data-tour={tourId}
      aria-label={`Switch to ${next} view`}
      onClick={() => onChange(next)}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-foreground transition-colors hover:bg-muted active:scale-95",
        className
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={next}
          className="flex items-center justify-center"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
