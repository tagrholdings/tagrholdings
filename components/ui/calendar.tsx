"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

/**
 * shadcn's Calendar (react-day-picker), skinned with this app's tokens: flat, no shadows, accent for the picked day.
 * Weeks start on Monday, like the Activities week board.
 */
export function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      weekStartsOn={1}
      showOutsideDays
      className={cn("p-3", className)}
      classNames={{
        root: "relative w-fit",
        months: "flex flex-col",
        month: "space-y-2",
        month_caption: "flex h-8 items-center justify-center text-sm font-medium text-foreground",
        caption_label: "select-none",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-normal text-muted-foreground",
        week: "mt-1 flex",
        day: "size-9 p-0 text-center text-sm",
        day_button:
          "size-9 rounded-md font-normal text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        selected: "[&>button]:bg-accent [&>button]:font-medium [&>button]:text-ink [&>button]:hover:bg-accent-hover",
        today: "[&>button]:border [&>button]:border-accent",
        outside: "[&>button]:text-muted-foreground/50",
        disabled: "[&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />),
      }}
      {...props}
    />
  );
}
