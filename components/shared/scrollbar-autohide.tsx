"use client";

import { useEffect } from "react";

/** How long a scrollbar stays visible after the last scroll. */
const VISIBLE_MS = 1200;

/**
 * Desktop scrollbars are drawn only while something is scrolling (see globals.css: `[data-scrolling]`). One capturing
 * listener on the document marks whichever element scrolled — scroll events don't bubble, capture still sees them —
 * and clears the mark shortly after it stops. Renders nothing.
 */
export function ScrollbarAutoHide() {
  useEffect(() => {
    const timers = new Map<Element, number>();
    function onScroll(event: Event) {
      const target = event.target === document ? document.documentElement : event.target;
      if (!(target instanceof Element)) return;
      target.setAttribute("data-scrolling", "");
      window.clearTimeout(timers.get(target));
      timers.set(
        target,
        window.setTimeout(() => {
          target.removeAttribute("data-scrolling");
          timers.delete(target);
        }, VISIBLE_MS)
      );
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);
  return null;
}
