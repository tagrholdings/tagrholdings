"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TourStep } from "../page-help";
import { mobileCardSide, placeTooltip, sameRect, spotlightRect, SPOTLIGHT_PADDING, type Rect } from "./tour-geometry";
import { VaultFillDemo } from "./VaultFillDemo";

/** Above every other layer in the app (the highest in use is `z-[100]`). */
const LAYER = "z-[110]";
const TIP_WIDTH = 340;

function targetElement(step: TourStep | undefined): HTMLElement | null {
  if (!step?.target) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(step.target)}"]`);
}

/** An element that isn't rendered, is hidden, or has no size can't be pointed at. */
function isPointable(element: HTMLElement | null): boolean {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Steps a given viewport can actually show: a step marked `only` for the other one is dropped, and a step whose
 * element isn't on the page right now (an empty table, a banner that isn't showing) is skipped instead of
 * stalling the tour. A step with no `target` is the centred intro and always survives.
 */
export function usableSteps(steps: TourStep[], isMobile: boolean, canPointAt: (step: TourStep) => boolean): TourStep[] {
  return steps.filter((step) => {
    if (step.only === "mobile" && !isMobile) return false;
    if (step.only === "desktop" && isMobile) return false;
    return !step.target || canPointAt(step);
  });
}

/** True only after hydration — the overlay portals into `document.body`, which doesn't exist while rendering on the server. */
const NEVER_CHANGES = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface TourOverlayProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}

/**
 * The guided tour: a dimmed backdrop with a hole cut around one element at a time, plus a card explaining it.
 *
 * Positions are read straight from `getBoundingClientRect()` on every animation frame while the tour is open, so the
 * spotlight follows the element through scrolling (including inside a panel that scrolls on its own), resizing and
 * layout shifts without any listener plumbing. State only changes when the rectangle really moved (`sameRect`).
 */
export function TourOverlay({ steps, open, onClose }: TourOverlayProps) {
  const isMobile = useIsMobile();
  const mounted = useMounted();
  const [index, setIndex] = useState(0);
  const [openedAt, setOpenedAt] = useState(open);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipSize, setTipSize] = useState({ width: TIP_WIDTH, height: 180 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tipRef = useRef<HTMLDivElement>(null);

  // Each run starts at the first step. Adjusting state during render (rather than in an effect) is React's own
  // recommended shape for "reset when a prop changes" — it avoids a second render pass with a stale index.
  if (openedAt !== open) {
    setOpenedAt(open);
    setIndex(0);
  }

  const visible = mounted && open ? usableSteps(steps, isMobile, (step) => isPointable(targetElement(step))) : [];
  const step = visible[index];
  const isLast = index >= visible.length - 1;

  const close = useCallback(() => {
    setRect(null);
    onClose();
  }, [onClose]);

  // Bring the step's element into view, and keep the page from scrolling behind the tour.
  useEffect(() => {
    if (!open || !step) return;
    const element = targetElement(step);
    element?.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Follow the element: one read per frame, state updated only on a real move.
  useEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    const tick = () => {
      const element = targetElement(step);
      const next = element ? (element.getBoundingClientRect().toJSON() as Rect) : null;
      setRect((current) => (sameRect(current, next) ? current : next));
      setViewport((current) =>
        current.width === window.innerWidth && current.height === window.innerHeight
          ? current
          : { width: window.innerWidth, height: window.innerHeight }
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, step]);

  // The card's own size decides where it fits.
  useLayoutEffect(() => {
    const element = tipRef.current;
    if (!element) return;
    const measure = () => setTipSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, step, isMobile]);

  const next = useCallback(() => (isLast ? close() : setIndex((i) => i + 1)), [isLast, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, back]);

  // No step survived (every element is missing): render nothing rather than trap the user behind a backdrop.
  // "Show me" resets `touring` before setting it, so the button still works after this.
  if (!mounted || !open || !step || viewport.width === 0) return null;

  const hole = rect ? spotlightRect(rect, viewport, SPOTLIGHT_PADDING) : null;
  const side = isMobile ? mobileCardSide(rect, viewport) : null;
  const floating = !isMobile && rect ? placeTooltip(rect, tipSize, viewport) : null;

  const card = (
    <div
      ref={tipRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      className={cn(
        "pointer-events-auto rounded-lg border border-divider bg-surface p-4 shadow-lg",
        isMobile
          ? "fixed left-4 right-4"
          : rect
            ? "fixed w-[340px]"
            : "fixed left-1/2 top-1/2 w-[340px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2"
      )}
      style={
        isMobile
          ? side === "top"
            ? { top: "calc(env(safe-area-inset-top) + 1rem)" }
            : { bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }
          : floating
            ? { top: floating.top, left: floating.left }
            : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="tour-step-title" className="font-serif text-base font-semibold text-foreground">
          {step.title}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="End the tour"
          className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {step.demo && (
        <div className="mt-3">
          <VaultFillDemo fields={step.demo.fields} checkbox={step.demo.checkbox} button={step.demo.button} />
        </div>
      )}
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {index + 1} / {visible.length}
        </span>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <Button size="sm" variant="outline" onClick={back}>
              <ChevronLeft />
              Back
            </Button>
          )}
          <Button size="sm" onClick={next}>
            {isLast ? "Done" : "Next"}
            {!isLast && <ChevronRight />}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className={cn("fixed inset-0", LAYER)} data-tour-overlay>
      {/* The dim layer with a hole punched in it. Clicking it ends the tour; the highlighted element stays visible
          but not clickable, so a step can't be broken by a stray click. */}
      <svg
        className="pointer-events-auto absolute inset-0 size-full"
        width={viewport.width}
        height={viewport.height}
        onClick={close}
        aria-hidden
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="white" />
            {hole && <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="10" fill="black" />}
          </mask>
        </defs>
        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="rgb(0 0 0 / 0.6)" mask="url(#tour-mask)" />
        {hole && (
          <rect
            x={hole.left}
            y={hole.top}
            width={hole.width}
            height={hole.height}
            rx="10"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        )}
      </svg>
      {card}
    </div>,
    document.body
  );
}
