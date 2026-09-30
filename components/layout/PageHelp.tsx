"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultBody } from "@/components/ui/vault";
import { getPageHelp } from "./page-help";

/**
 * The (?) button next to the theme toggle: opens a Vault that explains the current page — what it is and what it is
 * for. The text lives in `page-help.ts`, matched by route, so a page needs no code of its own. No entry = no button.
 */
export function PageHelp({ inboxAddress, className }: { inboxAddress: string | null; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const help = getPageHelp(pathname, { inboxAddress });
  if (!help) return null;

  return (
    <>
      <button
        type="button"
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
    </>
  );
}
