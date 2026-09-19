"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, Check, CircleHelp, Globe, Mail, MapPin, Phone, Undo2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-device";
import { SidePanel } from "@/components/shared/side-panel";
import { Vault, VaultContent, VaultHeader, VaultTitle, VaultBody } from "@/components/ui/vault";
import { Button } from "@/components/ui/button";
import { formatDateUS } from "@/utils/date";
import { SOURCE_LABELS } from "@/modules/leads/leads.constants";
import type { RawLeadStatus } from "@/modules/leads/leads.schema";
import type { RawLeadSummary } from "@/modules/leads/leads.types";
import { FitBadge } from "./FitBadge";
import { httpUrl, locationLine, signalList, text } from "./lead-fields";

interface RawLeadDetailPanelProps {
  lead: RawLeadSummary | null;
  /** The status shown right now (a just-handled lead flips before the server list refreshes). */
  status: RawLeadStatus | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPromote: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-0.5 px-4 py-2.5 text-sm sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function Actions({
  lead,
  status,
  busy,
  onPromote,
  onDismiss,
  onRestore,
}: Pick<RawLeadDetailPanelProps, "status" | "busy" | "onPromote" | "onDismiss" | "onRestore"> & { lead: RawLeadSummary }) {
  if (status === "new") {
    return (
      <div className="flex gap-2">
        <Button className="flex-1" loading={busy} onClick={() => onPromote(lead.id)}>
          Add to pipeline
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onDismiss(lead.id)}>
          Dismiss
        </Button>
      </div>
    );
  }
  if (status === "dismissed") {
    return (
      <Button variant="outline" className="w-full" loading={busy} onClick={() => onRestore(lead.id)}>
        <Undo2 />
        Restore to inbox
      </Button>
    );
  }
  return (
    <Button
      render={<Link href={lead.pipelineItemId ? `/leads?item=${lead.pipelineItemId}` : "/leads"} />}
      variant="outline"
      className="w-full"
    >
      Open in Leads
      <ArrowUpRight />
    </Button>
  );
}

function DetailBody({ lead }: { lead: RawLeadSummary }) {
  const fields = lead.extractedFields ?? {};
  const website = httpUrl(fields.website);
  const sourceUrl = httpUrl(lead.sourceUrl);
  const phone = text(fields.contact?.phone);
  const email = text(fields.contact?.email);
  const contactName = text(fields.contact?.name);
  const location = locationLine(fields);
  const signals = signalList(fields);
  const summary = text(fields.summary);
  const note = text(fields.note);

  return (
    <div className="space-y-5">
      {summary && <p className="text-sm leading-relaxed text-foreground">{summary}</p>}
      {note && <p className="rounded-lg border border-divider bg-surface-alt px-3 py-2 text-sm text-foreground"><span className="font-medium">Note: </span>{note}</p>}

      {lead.fit && (
        <div>
          <p className="label-kicker mb-2 flex items-center gap-2">
            Fit with {lead.searchProfileName ?? "the profile"}
            <FitBadge status={lead.fit.status} />
          </p>
          <ul className="divide-y divide-divider rounded-lg border border-divider bg-background">
            {lead.fit.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2 px-3 py-2 text-sm">
                {check.result === "pass" && <Check className="mt-0.5 size-4 shrink-0 text-success" />}
                {check.result === "fail" && <X className="mt-0.5 size-4 shrink-0 text-destructive" />}
                {check.result === "unknown" && <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{check.label}</span>
                  <span className="block text-xs text-muted-foreground">{check.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2.5 rounded-lg border border-divider bg-background p-4 text-sm">
        {text(fields.industry) && (
          <div className="flex items-center gap-2 text-foreground">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            {text(fields.industry)}
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            {location}
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-foreground">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${phone}`} className="hover:underline">
              {phone}
            </a>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2 text-foreground">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <a href={`mailto:${email}`} className="truncate hover:underline">
              {email}
            </a>
          </div>
        )}
        {website && (
          <div className="flex items-center gap-2 text-foreground">
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <a href={website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
              {website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      <dl className="divide-y divide-divider rounded-lg border border-divider bg-background empty:hidden">
        <Fact label="Asking price" value={text(fields.askingPrice)} />
        <Fact label="Est. revenue" value={text(fields.estimatedRevenue)} />
        <Fact label="Reason for selling" value={text(fields.reasonForSelling)} />
        <Fact label="Employees" value={text(fields.employees)} />
        <Fact label="Years in business" value={text(fields.yearsInBusiness)} />
        <Fact label="Contact person" value={contactName} />
      </dl>

      {signals.length > 0 && (
        <div>
          <p className="label-kicker mb-2">Signals</p>
          <ul className="flex flex-wrap gap-1.5">
            {signals.map((signal) => (
              <li key={signal} className="rounded-pill border border-divider bg-surface-alt px-2.5 py-0.5 text-xs text-foreground">
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Found {formatDateUS(lead.createdAt)} via {SOURCE_LABELS[lead.sourceType] ?? lead.sourceType}
          {lead.searchProfileName ? ` · ${lead.searchProfileName}` : ""}
        </p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
          >
            View original listing
            <ArrowUpRight className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Vault (mobile) / SidePanel (tablet+desktop) dual pattern — see side-panel.tsx. */
export function RawLeadDetailPanel({ lead, status, busy, onOpenChange, ...actions }: RawLeadDetailPanelProps) {
  const isMobile = useIsMobile();
  const open = lead !== null;

  if (isMobile) {
    return (
      <Vault open={open} onOpenChange={onOpenChange}>
        <VaultContent aria-label={lead?.businessName ?? "Lead"}>
          {lead && (
            <>
              <VaultHeader showCloseButton={false}>
                <VaultTitle>{lead.businessName}</VaultTitle>
              </VaultHeader>
              <VaultBody>
                <div className="space-y-5 pb-4">
                  <DetailBody lead={lead} />
                  <Actions lead={lead} status={status} busy={busy} {...actions} />
                </div>
              </VaultBody>
            </>
          )}
        </VaultContent>
      </Vault>
    );
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={lead?.businessName ?? ""}
      footer={lead ? <Actions lead={lead} status={status} busy={busy} {...actions} /> : undefined}
    >
      {lead && <DetailBody lead={lead} />}
    </SidePanel>
  );
}
