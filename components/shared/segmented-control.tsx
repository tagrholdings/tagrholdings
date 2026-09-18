"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  ariaLabel?: string;
}

/**
 * Standard toggle group for view/mode switches (Board vs List, Due date vs
 * Created date, etc.) — fixed `h-9` so it lines up with `SearchInput` and
 * `Button` in the same toolbar row instead of each control picking its own
 * height, and a solid `bg-accent text-ink` active segment (not a subtle
 * `bg-muted` tint) so which option is selected is actually visible.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex h-9 shrink-0 items-center rounded-md border border-divider bg-surface p-0.5", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.ariaLabel ?? option.label}
            aria-pressed={active}
            className={cn(
              "flex h-full items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-colors",
              option.label ? "px-2.5" : "w-8",
              active ? "bg-accent text-ink" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
