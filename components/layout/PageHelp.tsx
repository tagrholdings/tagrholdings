"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultBody } from "@/components/ui/vault";
import { getPageHelp } from "./page-help";
import { TourOverlay } from "./tour/TourOverlay";

/** The Vault slides out before the tour takes over the screen; starting both at once looks like a glitch. */
const VAULT_CLOSE_MS = 320;

/**
 * The (?) button next to the theme toggle: opens a Vault that explains the current page — what it is and what it is
 * for — with a "Show me" button that walks through the page itself. The text and the tour steps live in
 * `page-help.ts`, matched by route, so a page needs no code of its own beyond its `data-tour` attributes.
 */
export function PageHelp({ inboxAddress, className }: { inboxAddress: string | null; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the page mid-tour would point at elements that are gone. Adjusted during render, not in an effect, so
  // the new page never paints with the old page's tour still up.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
    setTouring(false);
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const help = getPageHelp(pathname, { inboxAddress });
  if (!help) return null;

  const startTour = () => {
    setOpen(false);
    setTouring(false); // so a run that ended with nothing to show can be started again
    timer.current = setTimeout(() => setTouring(true), VAULT_CLOSE_MS);
  };

  return (
    <>
      <button
        type="button"
        data-tour="header-help"
        aria-label={`About this page: ${help.title}`}
        title="About this page"
        onClick={() => setOpen(true)}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          className
        )}
      >
        <CircleHelp className="size-5" aria-hidden />
      </button>

      <Vault open={open} onOpenChange={setOpen}>
        <VaultContent aria-label={help.title}>
          <VaultHeader>
            <VaultTitle>{help.title}</VaultTitle>
            <VaultDescription>{help.summary}</VaultDescription>
          </VaultHeader>
          <VaultBody>
            <div className="space-y-5 pb-4 text-sm">
              {help.tour.length > 0 && (
                <Button onClick={startTour} className="w-full">
                  <Compass />
                  Show me around this page
                </Button>
              )}
              {help.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="label-kicker mb-1.5">{section.heading}</h3>
                  {Array.isArray(section.body) ? (
                    <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-foreground marker:text-muted-foreground">
                      {section.body.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="leading-relaxed text-foreground">{section.body}</p>
                  )}
                </section>
              ))}
            </div>
          </VaultBody>
        </VaultContent>
      </Vault>

      <TourOverlay steps={help.tour} open={touring} onClose={() => setTouring(false)} />
    </>
  );
}
