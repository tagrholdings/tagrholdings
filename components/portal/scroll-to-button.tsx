"use client";

import type { ReactNode } from "react";

/** Smooth-scrolls to an in-page section — the one bit of interactivity in the playbook's hero. */
export function ScrollToButton({ targetId, className, children }: { targetId: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })}
      className={className}
    >
      {children}
    </button>
  );
}
