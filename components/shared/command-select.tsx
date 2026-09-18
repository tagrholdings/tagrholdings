"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface CommandSelectGroup {
  label: string;
  options: CommandSelectOption[];
}

interface CommandSelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Flat list, or use `groups` instead for a sectioned list (e.g. "Team" / "Contacts"). */
  options?: CommandSelectOption[];
  groups?: CommandSelectGroup[];
  /** Shows a "Create “query”" row when the search has no exact match — e.g. a new organization. */
  onCreate?: (label: string) => void;
  createLabel?: string;
  className?: string;
}

/**
 * A searchable picker rendered *inline* — never a portal, never its own
 * Vault/Dialog/Popover. This exists specifically because `Select`
 * (components/ui/select.tsx) renders as its own `Vault` (a vaul Drawer) on
 * mobile, and nesting a Drawer inside another Drawer (every relational
 * picker in `CreateActivityVault` sits inside the outer "New activity"
 * Vault) breaks — the outer Drawer's focus trap / aria-hidden fights the
 * inner one. Being inline sidesteps that category of bug entirely and
 * needs no separate mobile/desktop branch, unlike `Select`.
 *
 * Use this for any relational picker with more than a handful of options
 * (contacts, pipeline items, organizations, team members) — `Select` is
 * still fine for small fixed enums (e.g. priority) that aren't nested this
 * deep and don't need search.
 */
export function CommandSelect({
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  options,
  groups,
  onCreate,
  createLabel = "Create",
  className,
}: CommandSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allOptions = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  const selected = allOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Let the panel mount before focusing, otherwise the click that opened
      // it can steal focus back.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function matches(option: CommandSelectOption) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return option.label.toLowerCase().includes(q) || option.description?.toLowerCase().includes(q);
  }

  function select(optionValue: string) {
    onChange(optionValue === value ? undefined : optionValue);
    setOpen(false);
  }

  const filteredGroups = groups
    ?.map((g) => ({ ...g, options: g.options.filter(matches) }))
    .filter((g) => g.options.length > 0);
  const filteredFlat = options?.filter(matches);
  const isEmpty = groups ? (filteredGroups?.length ?? 0) === 0 : (filteredFlat?.length ?? 0) === 0;
  const trimmedQuery = query.trim();
  const canCreate =
    !!onCreate && trimmedQuery.length > 0 && !allOptions.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen(!open);
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-divider bg-surface px-3 text-sm text-foreground transition-all outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 md:h-9"
      >
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              aria-label="Clear"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-divider bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter inside a Vault form would otherwise submit the whole form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canCreate) {
                    onCreate?.(trimmedQuery);
                    setOpen(false);
                  }
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {isEmpty && !canCreate && <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>}

            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  onCreate?.(trimmedQuery);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium text-accent transition-colors hover:bg-muted/60"
              >
                <Plus className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {createLabel} &ldquo;{trimmedQuery}&rdquo;
                </span>
              </button>
            )}

            {groups
              ? filteredGroups?.map((group) => (
                  <div key={group.label} className="mb-1 last:mb-0">
                    <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.label}</p>
                    {group.options.map((option) => (
                      <CommandOption key={option.value} option={option} active={option.value === value} onSelect={select} />
                    ))}
                  </div>
                ))
              : filteredFlat?.map((option) => (
                  <CommandOption key={option.value} option={option} active={option.value === value} onSelect={select} />
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandOption({
  option,
  active,
  onSelect,
}: {
  option: CommandSelectOption;
  active: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors",
        active ? "bg-muted text-foreground font-medium" : "text-foreground hover:bg-muted/60"
      )}
    >
      <span className="min-w-0 truncate">{option.label}</span>
      {active && <Check className="size-4 shrink-0 text-accent" />}
    </button>
  );
}
