"use client";

import { ReactNode, useRef } from "react";
import { AnimatedSection } from "@/components/landing/animated-section";
import { motion, useMotionValue, useSpring, useAnimationFrame, useTransform } from "framer-motion";

interface HeroHeaderProps {
  kicker: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function HeroHeader({
  kicker,
  title,
  description,
  actions,
  children,
}: HeroHeaderProps) {
  const containerRef = useRef<HTMLElement>(null);
  
  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  
  const time = useMotionValue(0);

  useAnimationFrame((t) => {
    time.set(t);
  });

  // Calculate distinct horizontal movements for each wave
  // Time creates continuous smooth waves, smoothMouseX adds interactive movement
  const x1 = useTransform([time, smoothMouseX], ([t, m]) => 
    Math.sin((t as number) / 3000) * 40 + (m as number) * 0.4
  );
  const x2 = useTransform([time, smoothMouseX], ([t, m]) => 
    Math.cos((t as number) / 4000) * 50 + (m as number) * 0.7
  );
  const x3 = useTransform([time, smoothMouseX], ([t, m]) => 
    Math.sin((t as number) / 5000 + 1) * 60 + (m as number) * 1.0
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalizedX = (x / rect.width - 0.5) * 2; // -1 to 1
    // The waves follow the mouse movement horizontally
    mouseX.set(normalizedX * 100); 
  };

  return (
    <header 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden bg-[var(--ink)] py-24 text-[var(--cream)] sm:py-32 lg:py-18"
    >
      <svg
        className="pointer-events-none absolute inset-y-0 -left-[10%] h-full w-[120%] opacity-40"
        viewBox="0 0 1200 500"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path style={{ x: x1 }} d="M-50,420 C 200,380 300,460 550,410 C 800,360 950,440 1250,390" stroke="#9C7A3C" strokeWidth="1" fill="none" opacity="0.5" />
        <motion.path style={{ x: x2 }} d="M-50,460 C 220,430 320,490 570,450 C 820,410 970,470 1250,430" stroke="#9C7A3C" strokeWidth="1" fill="none" opacity="0.35" />
        <motion.path style={{ x: x3 }} d="M-50,380 C 180,330 310,400 540,350 C 790,300 930,380 1250,330" stroke="#9C7A3C" strokeWidth="1" fill="none" opacity="0.25" />
      </svg>

      <div className="relative mx-auto flex max-w-6xl flex-col px-6 lg:px-8">
        <AnimatedSection className="max-w-4xl">
          <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.2em] text-[#C7A667]">
            {kicker}
          </p>
          <h1 className="max-w-3xl font-serif text-[clamp(2.5rem,4.8vw,4.7rem)] font-medium leading-[1.05] tracking-[-0.01em]">
            {title}
          </h1>
          <p className="mt-7 max-w-[520px] text-[17px] leading-[1.65] text-[rgba(245,242,236,0.72)]">
            {description}
          </p>
          {actions}
        </AnimatedSection>
        {children}
      </div>
    </header>
  );
}
