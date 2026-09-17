"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useAnimationFrame, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedWavesProps {
  /** Tunes opacity/blend on top of the defaults below — the SVG itself
   *  already carries low per-path opacities, this is an extra multiplier
   *  for contexts (like the sidebar) that need it fainter still. */
  className?: string;
}

/**
 * Three thin, slowly drifting brass lines with a subtle mouse-follow —
 * originally the marketing site's dark hero decoration
 * (components/shared/hero-header.tsx), now shared with any other dark
 * (`bg-ink`/`bg-sidebar`) surface that wants the same signature (sign-in,
 * `Sidebar`). Caller is responsible for `position: relative` + `overflow-
 * hidden` on its container, and for giving its real content a higher
 * stacking context (`relative z-10`) — this renders as a plain `z-0`
 * absolutely-positioned layer, not `pointer-events-none`, since the mouse-
 * follow needs to see pointer movement; the stacking order alone keeps
 * clicks reaching real UI on top of it.
 */
export function AnimatedWaves({ className }: AnimatedWavesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const time = useMotionValue(0);

  useAnimationFrame((t) => {
    time.set(t);
  });

  const x1 = useTransform([time, smoothMouseX], ([t, m]) => Math.sin((t as number) / 3000) * 40 + (m as number) * 0.4);
  const x2 = useTransform([time, smoothMouseX], ([t, m]) => Math.cos((t as number) / 4000) * 50 + (m as number) * 0.7);
  const x3 = useTransform([time, smoothMouseX], ([t, m]) => Math.sin((t as number) / 5000 + 1) * 60 + (m as number) * 1.0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const normalizedX = (x / rect.width - 0.5) * 2;
    mouseX.set(normalizedX * 100);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn("absolute inset-0 z-0 overflow-hidden", className)}
    >
      <svg
        className="absolute inset-y-0 -left-[10%] h-full w-[120%] opacity-40"
        viewBox="0 0 1200 500"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          style={{ x: x1 }}
          d="M-50,420 C 200,380 300,460 550,410 C 800,360 950,440 1250,390"
          stroke="var(--accent)"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <motion.path
          style={{ x: x2 }}
          d="M-50,460 C 220,430 320,490 570,450 C 820,410 970,470 1250,430"
          stroke="var(--accent)"
          strokeWidth="1"
          fill="none"
          opacity="0.35"
        />
        <motion.path
          style={{ x: x3 }}
          d="M-50,380 C 180,330 310,400 540,350 C 790,300 930,380 1250,330"
          stroke="var(--accent)"
          strokeWidth="1"
          fill="none"
          opacity="0.25"
        />
      </svg>
    </div>
  );
}
