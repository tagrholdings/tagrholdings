import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Small pieces the mock screens are built from. They use the app's own tokens, so the tour follows the theme. ── */

const TONES = {
  g: "bg-green-600/15 text-green-800 dark:text-green-400",
  y: "bg-accent/15 text-accent-text",
  r: "bg-destructive/10 text-destructive",
  n: "bg-muted text-muted-foreground",
  k: "bg-foreground text-background",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "n", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-block rounded-pill px-2 py-0.5 text-[11px] leading-5 font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-xs text-muted-foreground", className)}>{children}</span>;
}

/** A cell with a title and a smaller line under it. */
export function Two({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-foreground">{title}</p>
      {sub && <Sub className="block">{sub}</Sub>}
    </div>
  );
}

export function Btn({ children, ghost }: { children: ReactNode; ghost?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap",
        ghost ? "border border-divider text-foreground" : "bg-accent text-ink"
      )}
    >
      {children}
    </span>
  );
}

export function MiniTable({ head, rows, className, minWidth = "min-w-[34rem]" }: { head?: ReactNode[]; rows: ReactNode[][]; className?: string; minWidth?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-divider bg-surface", className)}>
      <table className={cn("w-full text-left text-xs", minWidth)}>
        {head && (
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} className="border-b border-divider px-3 py-2 font-mono text-[10px] font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-divider/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: ReactNode }) {
  const className = cn(
    "rounded-pill border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
    on ? "border-accent bg-accent text-ink" : "border-divider bg-surface text-muted-foreground",
    onClick && !on && "hover:text-foreground"
  );
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function Tile({ label, value, detail, valueClass }: { label: string; value: ReactNode; detail?: ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-divider bg-surface p-3">
      <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("my-1 font-serif text-2xl font-semibold", valueClass)}>{value}</p>
      {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function Pane({ kicker, title, children, className }: { kicker?: string; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-divider bg-surface p-5", className)}>
      {kicker && <p className="label-kicker mb-2 text-accent-text">{kicker}</p>}
      {title && <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>}
      {children && <div className={cn("text-sm text-muted-foreground", title && "mt-2")}>{children}</div>}
    </div>
  );
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="relative pl-4 before:absolute before:top-2 before:left-0.5 before:size-1.5 before:rounded-[2px] before:bg-accent">
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── The screen frame ── */

const NAV: [string, [string, string][]][] = [
  ["CRM", [["sourcing", "Sourcing"], ["leads", "Leads"], ["projects", "Projects"], ["activities", "Activities"], ["contacts", "Contacts"]]],
  ["TRACTION", [["overview", "Overview"], ["scorecard", "Scorecard"], ["rocks", "Rocks"], ["issues", "Issues"], ["l10", "L10s"]]],
  ["EOS", [["vision", "Vision"], ["people", "People"], ["process", "Process"], ["checkup", "Checkup"]]],
];

/** A browser window around a mock screen. With `nav`, the app's sidebar shows beside it on wide screens. */
export function MockWindow({ url, nav, workspace = "TAGR Holdings", children }: { url: string; nav?: string; workspace?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-divider bg-background">
      <div className="flex h-9 items-center gap-1.5 border-b border-divider bg-muted px-3">
        {[0, 1, 2].map((i) => (
          <i key={i} className="size-2.5 rounded-full bg-foreground/20" />
        ))}
        <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">{url}</span>
      </div>
      <div className="flex">
        {nav && (
          <nav aria-hidden className="hidden w-36 shrink-0 bg-sidebar p-2 text-xs text-sidebar-foreground lg:block">
            <p className="mb-2 flex items-center gap-2 border-b border-sidebar-border px-1.5 pb-3 font-semibold">
              <span className="flex size-5 items-center justify-center rounded-[5px] bg-accent text-[11px] font-bold text-ink">{workspace.charAt(0)}</span>
              <span className="truncate">{workspace}</span>
            </p>
            {NAV.map(([group, items]) => (
              <div key={group}>
                <p className="mt-3 mb-1 px-1.5 font-mono text-[9px] tracking-widest text-sidebar-foreground-muted">{group}</p>
                {items.map(([key, label]) => (
                  <p key={key} className={cn("rounded-md px-2 py-1.5", key === nav ? "bg-sidebar-hover text-accent" : "text-sidebar-foreground-muted")}>
                    {label}
                  </p>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

export function MockHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <p className="font-serif text-lg font-semibold text-foreground">{title}</p>
        {sub && <Sub>{sub}</Sub>}
      </div>
      {action}
    </div>
  );
}

export function MiniTabs({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-divider" aria-hidden>
      {items.map((item) => (
        <span key={item} className={cn("-mb-px border-b-2 px-2.5 py-1.5 text-xs whitespace-nowrap", item === active ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground")}>
          {item}
        </span>
      ))}
    </div>
  );
}

export const SOURCING_TABS = ["Review", "Emails", "Search profiles", "Listing sites", "Email sources"];

/* ── The page layout every section uses ── */

export interface Block {
  title: string;
  items: ReactNode[];
}

/**
 * One page of the tour: the words on one side, the screen on the other (stacked on a phone). `wide` drops the screen
 * and gives the children the full width, for the sections that are text and cards only.
 */
export function PageSection({
  id,
  kicker,
  title,
  lede,
  blocks,
  example,
  hint,
  notes,
  children,
  wide,
}: {
  id: string;
  kicker: string;
  title: string;
  lede: string;
  blocks?: Block[];
  example?: { tag?: string; text: ReactNode };
  hint?: string;
  notes?: ReactNode[];
  children?: ReactNode;
  wide?: boolean;
}) {
  const copy = (
    <div className="min-w-0">
      <p className="label-kicker mb-3 text-accent-text">{kicker}</p>
      <h2 className="font-serif text-2xl leading-tight font-semibold text-foreground sm:text-3xl">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lede}</p>
      {blocks?.map((block) => (
        <div key={block.title} className="mt-5">
          <h3 className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{block.title}</h3>
          <BulletList items={block.items} />
        </div>
      ))}
      {example && (
        <div className="mt-6 rounded-r-lg border-l-2 border-accent bg-surface p-4">
          <p className="label-kicker mb-1 text-accent-text">{example.tag ?? "Example"}</p>
          <p className="text-sm leading-relaxed text-foreground">{example.text}</p>
          {hint && <p className="mt-3 inline-block rounded-pill bg-success/10 px-2.5 py-1 font-mono text-[11px] tracking-wide text-green-800 dark:text-green-400 uppercase">{hint}</p>}
        </div>
      )}
      {notes && (
        <details className="group mt-5 rounded-lg border border-divider bg-muted/40 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">About this page</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  return (
    <section id={id} className="scroll-mt-16 border-b border-divider py-10 sm:py-14">
      {wide ? (
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
          {copy}
          {children}
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
          {copy}
          <div className="min-w-0 lg:pt-8">{children}</div>
        </div>
      )}
    </section>
  );
}

/** The dark band that opens each part. */
export function PartBand({ num, title, em, lede, pages }: { num: string; title: string; em: string; lede: string; pages: string[] }) {
  return (
    <div className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-mono text-sm tracking-[0.2em] text-accent">PART {num}</p>
        <h2 className="mt-3 font-serif text-4xl leading-tight font-semibold sm:text-6xl">
          {title} <span className="text-accent">{em}</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-sidebar-foreground-muted">{lede}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {pages.map((page) => (
            <span key={page} className="rounded-pill border border-sidebar-border px-3 py-1 text-sm text-sidebar-foreground">
              {page}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
