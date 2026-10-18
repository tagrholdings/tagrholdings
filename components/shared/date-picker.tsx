"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatDateUS, parseLocalDateTime, toDateInputValue } from "@/utils/date";

interface DatePickerProps {
  /** "yyyy-mm-dd" (the same string an `<input type="date">` holds), or "" / undefined for none. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A date field that opens a calendar when you click anywhere on it (a native `<input type="date">` only opens its
 * calendar from the tiny icon on desktop). Rendered *inline*, never a portal or Popover, for the same reason as
 * `CommandSelect`: it sits inside a Vault (vaul Drawer) and a nested overlay fights the outer one's focus trap.
 */
export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = value ? parseLocalDateTime(value) : undefined;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-divider bg-surface px-3 text-sm text-foreground transition-all outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 md:h-9"
      >
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
          {selected ? formatDateUS(selected, { month: "short", day: "numeric", year: "numeric" }) : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
          <CalendarDays className="size-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 rounded-md border border-divider bg-popover">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              onChange(day ? toDateInputValue(day) : "");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
