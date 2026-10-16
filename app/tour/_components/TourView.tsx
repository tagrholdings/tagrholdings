"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ChevronLeft, List, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { SECTION_BODIES } from "./sections";
import { TOUR_PARTS } from "./tour-nav";
import { PartBand } from "./ui";

const SECTIONS = TOUR_PARTS.flatMap((part) => part.sections.map((s) => ({ ...s, part: part.label })));

/**
 * The platform tour as one long page that reads the same on a phone and a computer: a bar that stays on top (Back to
 * the CRM, where you are, contents), the parts in order, and screens you can click. The CRM's own design tokens, so it
 * follows the theme. Nothing here is saved or sent anywhere.
 */
export function TourView({ backHref }: { backHref: string }) {
  const [contentsOpen, setContentsOpen] = useState(false);
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!contentsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setContentsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contentsOpen]);

  const where = SECTIONS.find((s) => s.id === current);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div aria-hidden className="fixed top-0 left-0 z-40 h-0.5 bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-divider bg-background/90 px-3 backdrop-blur sm:px-5">
        <Link href={backHref} className="flex h-9 shrink-0 items-center gap-1 rounded-pill border border-divider bg-surface pr-3.5 pl-2 text-sm font-semibold text-foreground transition-colors hover:border-accent">
          <ChevronLeft className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Back to the CRM</span>
          <span className="sm:hidden" aria-hidden>Back</span>
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate font-serif text-sm font-semibold sm:text-base">Platform tour</p>
          {where && <p className="truncate text-[11px] text-muted-foreground">{where.part} · {where.title}</p>}
        </div>
        <ThemeToggle className="hover:bg-muted" />
        <button
          type="button"
          onClick={() => setContentsOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-sm font-semibold text-ink"
        >
          <List className="size-4" aria-hidden />
          Contents
        </button>
      </header>

      {/* ── Opening ── */}
      <div className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24">
          <div className="mb-8 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-xl bg-accent font-serif text-2xl font-bold text-ink">T</span>
            <p className="label-kicker text-accent">Tagr Holdings · Phoenix, AZ</p>
          </div>
          <h1 className="font-serif text-5xl leading-none font-semibold sm:text-8xl">
            TAGR <span className="text-accent">CRM</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-sidebar-foreground-muted sm:text-2xl">
            One platform to find businesses to buy, work every deal to close, and run each company we own on EOS, from a broker’s listing to the weekly L10.
          </p>
          <p className="mt-6 max-w-2xl text-sm text-sidebar-foreground-muted">
            A short tour of every page, for someone who has never used it. Scroll to read, tap <b className="text-sidebar-foreground">Contents</b> to jump anywhere, and try the screens: filters, checkboxes, boards and timers all work.
          </p>
          <a href="#why" className="mt-8 inline-flex h-11 items-center gap-2 rounded-pill bg-accent px-6 font-semibold text-ink">
            Start the tour
            <ArrowDown className="size-4" aria-hidden />
          </a>
        </div>
      </div>

      {/* ── The parts ── */}
      {TOUR_PARTS.map((part) => (
        <Fragment key={part.id}>
          {part.heading && <PartBand num={part.heading.num} title={part.heading.title} em={part.heading.em} lede={part.heading.lede} pages={part.sections.map((s) => s.title)} />}
          {part.sections.map((section) => (
            <Fragment key={section.id}>{SECTION_BODIES[section.id]}</Fragment>
          ))}
        </Fragment>
      ))}

      {/* ── Close ── */}
      <div className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="font-serif text-4xl leading-tight font-semibold sm:text-7xl">
            Find. Close. <span className="text-accent">Operate.</span>
          </h2>
          <p className="mt-5 max-w-3xl text-lg text-sidebar-foreground-muted sm:text-xl">One platform from the first broker listing to the weekly L10, for every company in the portfolio.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[["4", "ways deals come in, one review queue"], ["~1¢", "per lead in API costs (demo data)"], ["1", "Portfolio view across every company"]].map(([big, text]) => (
              <div key={big}>
                <p className="font-serif text-5xl font-semibold text-accent">{big}</p>
                <p className="mt-1 text-sm text-sidebar-foreground-muted">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-sidebar-foreground-muted">Want every detail? The full guide is under Documentation in the CRM, and every page there has its own (?) help and guided tour.</p>
          <Link href={backHref} className="mt-6 inline-flex h-11 items-center gap-2 rounded-pill bg-accent px-6 font-semibold text-ink">
            <ChevronLeft className="size-4" aria-hidden />
            Back to the CRM
          </Link>
        </div>
      </div>

      {/* ── Contents ── */}
      {contentsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Contents">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-divider px-4 sm:px-6">
            <p className="font-serif text-base font-semibold">Contents</p>
            <button type="button" onClick={() => setContentsOpen(false)} aria-label="Close contents" className="flex size-9 items-center justify-center rounded-full hover:bg-muted">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {TOUR_PARTS.map((part) => (
                <div key={part.id}>
                  <p className="label-kicker mb-2 text-accent-text">{part.label}</p>
                  <ul className="space-y-0.5">
                    {part.sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          onClick={() => setContentsOpen(false)}
                          className={cn("block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted", section.id === current ? "bg-accent/15 font-semibold text-foreground" : "text-muted-foreground")}
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
