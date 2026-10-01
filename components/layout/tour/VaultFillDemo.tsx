"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface VaultFillDemoProps {
  /** Plain field labels, not a vault's real field names — see `TourStep.demo` in `page-help.ts`. */
  fields: string[];
  /**
   * Label of one checkbox to show getting ticked, for a step whose vault has a checkbox decision that
   * actually matters (e.g. which sources to search) — not every stray "optional" checkbox a vault has.
   */
  checkbox?: string;
  /** The vault's primary button label. */
  button: string;
}

const CYCLE_SECONDS = 4.5;
// The checkbox ticks after the fields finish filling (last field lands around 0.28 + 0.3 = 0.58) and before the button press at 0.78.
const CHECKBOX_TICK_AT = 0.68;

/**
 * A small looping illustration inside a tour card: fake inputs filling in, then the primary button
 * being pressed. Shown above a tour step's text when that step points at a button that opens a Vault,
 * so "here's where" also shows "here's roughly what happens". Purely decorative — it renders made-up
 * fields, never the vault's real form, so it can't go stale when that form changes.
 */
export function VaultFillDemo({ fields, checkbox, button }: VaultFillDemoProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="mb-3 rounded-md border border-divider bg-surface-alt p-3">
        <div className="space-y-2.5">
          {fields.map((field) => (
            <div key={field}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{field}</div>
              <div className="h-6 w-full rounded border border-divider bg-muted" />
            </div>
          ))}
        </div>
        {checkbox && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-divider bg-[var(--accent)]">
              <Check className="size-3 text-white" aria-hidden />
            </div>
            <span className="text-xs text-muted-foreground">{checkbox}</span>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <div className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white">{button}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-divider bg-surface-alt p-3">
      <div className="space-y-2.5">
        {fields.map((field, i) => (
          <div key={field}>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{field}</div>
            <div className="h-6 w-full p-2 overflow-hidden rounded border border-divider bg-muted">
              <motion.div
                className="h-full rounded-sm bg-[var(--accent)]/30"
                animate={{ width: ["0%", "0%", "85%", "85%", "0%"] }}
                transition={{
                  duration: CYCLE_SECONDS,
                  repeat: Infinity,
                  ease: "easeInOut",
                  // Fields fill one after another, then everything holds before resetting for the next loop.
                  times: [0, 0.08 + i * 0.15, 0.28 + i * 0.15, 0.75, 1],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {checkbox && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-divider">
            <motion.div
              className="absolute inset-0 rounded-sm bg-[var(--accent)]"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: CYCLE_SECONDS, repeat: Infinity, ease: "easeInOut", times: [0, CHECKBOX_TICK_AT - 0.03, CHECKBOX_TICK_AT, 0.75, 1] }}
            />
            <motion.div
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: CYCLE_SECONDS, repeat: Infinity, ease: "easeInOut", times: [0, CHECKBOX_TICK_AT - 0.03, CHECKBOX_TICK_AT, 0.75, 1] }}
            >
              <Check className="relative size-3 text-white" aria-hidden />
            </motion.div>
          </div>
          <span className="text-xs text-muted-foreground">{checkbox}</span>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <motion.div
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
          animate={{ scale: [1, 1, 0.92, 1, 1] }}
          transition={{ duration: CYCLE_SECONDS, repeat: Infinity, ease: "easeInOut", times: [0, 0.78, 0.84, 0.9, 1] }}
        >
          {button}
        </motion.div>
      </div>
    </div>
  );
}
