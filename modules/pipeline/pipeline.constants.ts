import type { BoardColumn } from "./pipeline.schema";

/** Every tenant's system-seeded "Leads" board (see pipeline.service.ts's `ensureDefaultBoard`). */
export const DEFAULT_BOARD_NAME = "Leads";
export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: "sourced", label: "Sourced" },
  { id: "outreach", label: "Outreach" },
  { id: "in_discussion", label: "In Discussion" },
  { id: "offer_submitted", label: "Offer Submitted" },
  { id: "diligence", label: "Diligence" },
  { id: "closed", label: "Closed" },
];

/** Cycled by column index — boards don't store a color, columns are just {id, label}. */
const COLUMN_DOT_CLASSES = [
  "bg-accent",
  "bg-secondary-accent",
  "bg-muted-foreground",
  "bg-destructive",
  "bg-success",
];

export function columnDotClassName(index: number) {
  return COLUMN_DOT_CLASSES[index % COLUMN_DOT_CLASSES.length];
}
