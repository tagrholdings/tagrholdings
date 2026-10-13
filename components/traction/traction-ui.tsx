"use client";

import { ChevronDown } from "lucide-react";
import { cn, initialsFor } from "@/lib/utils";
import { CommandSelect } from "@/components/shared/command-select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { memberName } from "@/modules/traction/traction.logic";
import { SETTABLE_ROCK_STATUSES, ROCK_STATUS_LABELS, type RockStatus, type TractionMember } from "@/modules/traction/traction.types";

type SettableRockStatus = (typeof SETTABLE_ROCK_STATUSES)[number];

/** An owner: initials + first name (and their seat, when they have one), or a muted "No owner". */
export function OwnerBadge({ members, userId, compact = false, className }: { members: TractionMember[]; userId: string | null | undefined; compact?: boolean; className?: string }) {
  const name = memberName(members, userId);
  if (!name) return <span className={cn("text-sm text-muted-foreground italic", className)}>No owner</span>;
  const seat = members.find((m) => m.id === userId)?.seat;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-sm text-foreground", className)} title={seat ? `${name} · ${seat}` : name}>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-divider bg-muted text-[10.5px] font-semibold">
        {initialsFor(name)}
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate">{name.split(" ")[0]}</span>
          {seat && <span className="block truncate text-[11px] text-muted-foreground">{seat}</span>}
        </span>
      )}
    </span>
  );
}

const NO_OWNER = "__none__";

/** Picks a team person (or nobody, unless `required`). Inline, so it works inside a Vault — see CommandSelect. */
export function OwnerPicker({
  members,
  value,
  onChange,
  placeholder = "Who owns it?",
  required = false,
}: {
  members: TractionMember[];
  value: string | null | undefined;
  onChange: (personId: string | null) => void;
  placeholder?: string;
  /** EOS: every number, Rock and To-Do has exactly one owner — no "No owner" choice then. */
  required?: boolean;
}) {
  return (
    <CommandSelect
      value={value ?? undefined}
      onChange={(v) => onChange(!v || v === NO_OWNER ? null : v)}
      placeholder={placeholder}
      searchPlaceholder="Search people…"
      options={[
        ...(required ? [] : [{ value: NO_OWNER, label: "No owner" }]),
        ...members.map((m) => ({ value: m.id, label: m.name || m.email, description: m.seat || m.email || undefined })),
      ]}
    />
  );
}

/** A small fixed set of choices as pills (cadence, unit, status…) — same look as the activity form's pickers. */
export function ChoicePills<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
            value === option.value ? "border-accent bg-accent text-ink" : "border-divider bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<RockStatus, string> = {
  on_track: "bg-[color-mix(in_srgb,var(--slate)_16%,transparent)] text-green-800 dark:text-green-400",
  off_track: "bg-destructive/10 text-destructive",
  complete: "bg-accent/15 text-accent-text",
  dropped: "bg-muted text-muted-foreground line-through",
  rolled_over: "bg-muted text-muted-foreground",
};

export function RockStatusPill({ status, className }: { status: RockStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLES[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ROCK_STATUS_LABELS[status]}
    </span>
  );
}

/** The status pill as a menu — the Rock Review's one question ("on track or off?") answered in a click. */
export function RockStatusMenu({ status, onChange, disabled }: { status: RockStatus; onChange: (status: SettableRockStatus) => void; disabled?: boolean }) {
  // A rolled-over Rock is history (its copy lives in the next quarter): it shows its status but can't change it.
  if (status === "rolled_over") return <RockStatusPill status={status} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button type="button" aria-label={`Status: ${ROCK_STATUS_LABELS[status]}. Change`} className="inline-flex items-center gap-0.5 rounded-pill transition-opacity hover:opacity-80 disabled:opacity-60">
          <RockStatusPill status={status} />
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as SettableRockStatus)}>
          {SETTABLE_ROCK_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {ROCK_STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A thin stacked bar (complete / on track / off track) — the Rocks tile and the Portfolio row. */
export function RockBar({ complete, onTrack, offTrack, total }: { complete: number; onTrack: number; offTrack: number; total: number }) {
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-pill bg-muted" aria-hidden>
      <span className="h-full bg-accent" style={{ width: `${pct(complete)}%` }} />
      <span className="h-full bg-slate" style={{ width: `${pct(onTrack)}%` }} />
      <span className="h-full bg-destructive" style={{ width: `${pct(offTrack)}%` }} />
    </div>
  );
}
