"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * A floating right-side detail panel — same visual language as Sidebar
 * (fixed, inset from the viewport edges, rounded-lg, shadow-lg) rather than
 * the centered/bottom-sheet Vault, for "click a row, see details without
 * leaving the list" flows (Contacts, and per design.md's item 4 notes,
 * Pipeline item detail too). Full-width with a smaller inset on mobile since
 * there's no room for a fixed side column there.
 */
export function SidePanel({ open, onOpenChange, title, description, children, footer }: SidePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "110%" }}
            animate={{ x: 0 }}
            exit={{ x: "110%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            role="dialog"
            aria-label={title}
            className={cn(
              "fixed inset-y-2 inset-x-2 z-50 flex flex-col overflow-hidden rounded-lg border border-divider bg-surface shadow-lg",
              "md:inset-y-4 md:inset-x-auto md:right-4 md:w-[420px]"
            )}
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
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && <div className="border-t border-divider px-5 py-4">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
