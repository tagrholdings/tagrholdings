"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — the visible label usually sits beside the switch, not inside it. */
  "aria-label": string;
  className?: string;
}

/** An on/off toggle. Flat, no shadow (design.md); the track takes the accent color when on. */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-divider bg-muted",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-4 rounded-full transition-transform duration-200",
          checked ? "translate-x-[22px] bg-ink" : "translate-x-[3px] bg-muted-foreground"
        )}
      />
    </button>
  );
}
