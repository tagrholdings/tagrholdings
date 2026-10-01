"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultDescription, VaultBody } from "@/components/ui/vault";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateUS } from "@/utils/date";
import { httpUrl } from "../../_components/lead-fields";
import { explainSiteStatus } from "@/modules/listing-sites/site-status";
import type { ListingSiteSummary } from "@/modules/listing-sites/listing-sites.types";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";

interface Props {
  site: ListingSiteSummary | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSite: () => void;
  onIgnore: (site: ListingSiteSummary) => void;
}

/** What happened when the engine tried this site, in plain words, and what a person can do about it. */
export function SiteStatusVault({ site, busy, onOpenChange, onAddSite, onIgnore }: Props) {
  const path = useWorkspacePath();
  const explanation = site ? explainSiteStatus(site.status, site.statusDetail) : null;
  const url = site ? httpUrl(site.listingsUrl ?? site.siteUrl) : null;

  return (
    <Vault open={site !== null} onOpenChange={onOpenChange}>
      <VaultContent aria-label={site?.siteName ?? "Site details"}>
        {site && explanation && (
          <>
            <VaultHeader>
              <VaultTitle>{site.siteName}</VaultTitle>
              <VaultDescription>
                {explanation.label}
                {site.lastCrawledAt ? ` · last tried ${formatDateUS(site.lastCrawledAt, { month: "short", day: "numeric" })}` : ""}
              </VaultDescription>
            </VaultHeader>
            <VaultBody>
              <div className="space-y-5 pb-4 text-sm">
                <section>
                  <h3 className="label-kicker mb-1.5">What happened</h3>
                  <p className="text-foreground">{explanation.short}</p>
                </section>
                {explanation.why && (
                  <section>
                    <h3 className="label-kicker mb-1.5">Why</h3>
                    <p className="leading-relaxed text-muted-foreground">{explanation.why}</p>
                  </section>
                )}
                {explanation.steps.length > 0 && (
                  <section>
                    <h3 className="label-kicker mb-1.5">What you can do</h3>
                    <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed text-foreground marker:text-muted-foreground">
                      {explanation.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </section>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {explanation.actions.includes("open_site") && url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm" })}>
                      Open site
                      <ExternalLink />
                    </a>
                  )}
                  {explanation.actions.includes("email_sources") && (
                    <Link href={path("/leads-inbox/email-sources")} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Go to Email sources
                    </Link>
                  )}
                  {explanation.actions.includes("add_site") && (
                    <Button size="sm" variant="outline" onClick={onAddSite}>
                      Add site
                    </Button>
                  )}
                  {explanation.actions.includes("ignore") && site.active && (
                    <Button size="sm" variant="outline" loading={busy} onClick={() => onIgnore(site)}>
                      Ignore this site
                    </Button>
                  )}
                </div>
              </div>
            </VaultBody>
          </>
        )}
      </VaultContent>
    </Vault>
  );
}
