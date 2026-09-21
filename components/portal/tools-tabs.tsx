"use client";

import { useState, type ReactNode } from "react";

export type PortalToolId = "eos" | "urgency";

export interface ToolTab {
  id: PortalToolId;
  number: string;
  title: string;
  blurb: string;
  meta: string;
  content: ReactNode;
}

/**
 * Picker + panels for the /portal/tools page. Both tools stay mounted (the
 * inactive one is just `hidden`) so answers typed into one survive a trip to
 * the other. The tool bodies arrive as already-rendered nodes from the server
 * page, so their statements still only ship to visitors holding a valid token.
 */
export function ToolsTabs({ tabs, initialTool }: { tabs: ToolTab[]; initialTool: PortalToolId }) {
  const [active, setActive] = useState<PortalToolId>(initialTool);

  const select = (id: PortalToolId) => {
    setActive(id);
    // Keeps the URL shareable/reload-safe without a navigation. Other params
    // (notably `token`) are preserved.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tool", id);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // ignore — the tab still switches
    }
  };

  return (
    <>
      <div className="border-b border-[rgba(27,29,31,0.14)] bg-[var(--paper)] px-6 py-8 lg:px-8">
        <div role="tablist" aria-label="Portal tools" className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tool-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tool-panel-${tab.id}`}
                onClick={() => select(tab.id)}
                className={`flex cursor-pointer flex-col gap-2 rounded-sm border p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)] ${
                  isActive
                    ? "border-[var(--brass)] bg-[var(--ink)] text-[var(--cream)]"
                    : "border-[rgba(27,29,31,0.2)] bg-transparent text-[var(--ink)] hover:border-[var(--brass)]"
                }`}
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">Tool {tab.number}</span>
                  <span className={`font-mono text-[11px] uppercase tracking-[0.06em] ${isActive ? "text-[rgba(245,242,236,0.6)]" : "text-[rgba(27,29,31,0.55)]"}`}>
                    {tab.meta}
                  </span>
                </span>
                <span className="font-serif text-[22px] font-medium leading-tight">{tab.title}</span>
                <span className={`text-[13.5px] leading-[1.55] ${isActive ? "text-[rgba(245,242,236,0.72)]" : "text-[rgba(27,29,31,0.65)]"}`}>{tab.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tool-panel-${tab.id}`}
          aria-labelledby={`tool-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
