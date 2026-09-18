"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const PANEL_WIDTH = 400;

/**
 * A right-side detail panel that pushes the layout — a real flex sibling
 * of the main content (not a fixed overlay with a backdrop), so opening it
 * shrinks the content column exactly like the main Sidebar's collapse does,
 * instead of floating on top of it. Desktop/tablet only: the caller is
 * responsible for switching to `Vault` (bottom sheet) below `md` — see
 * PipelineItemDetail.tsx / WeekActivityDetail.tsx / ContactDetailPanel.tsx
 * for the established `useIsMobile()` branch. There's no backdrop here on
 * purpose — this isn't a modal, the main content stays interactive.
 *
 * Usage: render as a flex sibling of the main content inside a
 * `flex gap-4` row, e.g.:
 * ```tsx
 * <div className="flex flex-1 gap-4 min-w-0">
 *   <div className="min-w-0 flex-1">...table/board...</div>
 *   <SidePanel open={open} .../>
 * </div>
 * ```
 * The outer `motion.div` animates `width` (0 → 400px) with `overflow-hidden`
 * while the inner content stays a fixed 400px — that's what keeps the panel's
 * own content from squishing/reflowing mid-animation while its container
 * width (and therefore the main content's available space) actually changes.
 */
export function SidePanel({ open, onOpenChange, title, description, children, footer }: SidePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: PANEL_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className="flex shrink-0 self-stretch overflow-hidden"
        >
          <div
            role="dialog"
            aria-label={title}
            style={{ width: PANEL_WIDTH }}
            className="flex h-full shrink-0 flex-col overflow-hidden rounded-lg border border-divider bg-surface shadow-md"
          >
            <div className="flex items-start justify-between gap-2 border-b border-divider px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-serif text-lg font-semibold text-foreground">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && <div className="border-t border-divider px-5 py-4">{footer}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
