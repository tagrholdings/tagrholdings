"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Mail, Plus, Trash2, Wand2 } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button, buttonVariants } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS } from "@/utils/date";
import { httpUrl } from "../../_components/lead-fields";
import {
  attemptEmailSignupAction,
  deleteEmailSourceAction,
  setEmailSourceSubscribedAction,
} from "@/modules/email-sources/email-sources.actions";
import { emailSourceState, type EmailSourceRow, type EmailSourceState, type EmailSourceSummary } from "@/modules/email-sources/email-sources.types";
import { EmailSourceVault } from "./EmailSourceVault";

const STATE_LABELS: Record<EmailSourceState, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  subscribed: { label: "Subscribed", tone: "good" },
  awaiting_confirmation: { label: "Waiting for confirmation email", tone: "warn" },
  queued: { label: "Signup queued", tone: "warn" },
  ready: { label: "Ready to attempt", tone: "neutral" },
  manual: { label: "Manual signup", tone: "neutral" },
  captcha: { label: "Captcha — sign up by hand", tone: "bad" },
  needs_person: { label: "Needs a person — sign up by hand", tone: "bad" },
  failed: { label: "Last attempt failed", tone: "bad" },
};

const TONE_CLASSES = {
  good: "border-accent bg-accent/15 text-foreground",
  warn: "border-divider bg-surface-alt text-foreground",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  neutral: "border-divider bg-transparent text-muted-foreground",
} as const;

/** A site the engine couldn't do is shown in the "bad" tone even while its state is still "awaiting confirmation". */
function handoffTone(source: EmailSourceRow, tone: keyof typeof TONE_CLASSES) {
  return TONE_CLASSES[source.handoffReason ? "bad" : tone];
}

export function EmailSourcesView({ sources, inboxAddress }: { sources: EmailSourceRow[]; inboxAddress: string | null }) {
  // undefined = closed, null = creating, source = editing.
  const [editing, setEditing] = useState<EmailSourceSummary | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ serverError?: string; validationErrors?: unknown; data?: unknown } | undefined>, fail: string, onOk?: (data: unknown) => void) {
    setBusyId(id);
    try {
      const result = await fn();
      if (result?.serverError || result?.validationErrors) {
        notify.error(result.serverError ?? fail);
        return;
      }
      onOk?.(result?.data);
    } finally {
      setBusyId(null);
    }
  }

  const attempt = (s: EmailSourceSummary) =>
    run(s.id, () => attemptEmailSignupAction({ id: s.id }), "Couldn't queue that signup. Please try again.", (data) => {
      const dispatch = (data as { dispatch?: string } | undefined)?.dispatch;
      if (dispatch === "dispatched") notify.success("Signup started — watch this row for the confirmation.", 6000);
      else notify.info("Signup queued. It runs with the engine's next scheduled run.", 7000);
    });

  const setSubscribed = (s: EmailSourceSummary, subscribed: boolean) =>
    run(s.id, () => setEmailSourceSubscribedAction({ id: s.id, subscribed }), "Couldn't update that site.", () =>
      notify.success(subscribed ? "Marked as subscribed." : "Marked as not subscribed.")
    );

  const remove = (s: EmailSourceSummary) => {
    if (!window.confirm(`Remove ${s.siteName} from the list?`)) return;
    return run(s.id, () => deleteEmailSourceAction({ id: s.id }), "Couldn't remove that site.", () => notify.success("Removed."));
  };

  const addButton = (
    <Button onClick={() => setEditing(null)}>
      <Plus />
      Add site
    </Button>
  );
  const vault = <EmailSourceVault open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)} source={editing ?? null} />;

  const handoff = sources.filter((s) => s.handoffReason);
  const handoffBanner =
    handoff.length > 0 ? (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-destructive">
            {handoff.length === 1 ? "1 site needs to be signed up to by hand" : `${handoff.length} sites need to be signed up to by hand`}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            The engine doesn&rsquo;t solve captchas, accept NDAs or terms, or make up answers. Open each site below, sign up with the leads inbox address
            {inboxAddress ? <> ({inboxAddress})</> : null}, then click &ldquo;Mark subscribed&rdquo;.
          </p>
          <ul className="mt-2 list-inside list-disc text-muted-foreground">
            {handoff.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-foreground">{s.siteName}</span> — {s.handoffReason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  const intro = (
    <div className="rounded-lg border border-divider bg-surface p-4 text-sm text-muted-foreground">
      <p>
        Some listing sites only send their listings by <strong className="text-foreground">email</strong>. List them here and point their signup at the leads inbox
        {inboxAddress ? (
          <>
            {" "}
            (<span className="font-medium text-foreground">{inboxAddress}</span>)
          </>
        ) : null}
        : every email that arrives there is read automatically and becomes a lead in the Inbox.
      </p>
      <p className="mt-2">
        Signing up is a separate step from receiving. Where a site&rsquo;s form has no captcha, the engine can fill it in for you (give it the two selectors) —
        including your name, phone and company when the form asks. Sites with a captcha, or that want an NDA, terms or an account, are flagged here for you to do by hand. When the site sends its &ldquo;confirm your subscription&rdquo; email, the CRM clicks the link for you and marks the site
        subscribed.
      </p>
    </div>
  );

  if (sources.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {intro}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mail />
            </EmptyMedia>
            <EmptyTitle>No email sources yet</EmptyTitle>
            <EmptyDescription>Add the listing sites that deliver by email so you can track which ones are subscribed.</EmptyDescription>
          </EmptyHeader>
          {addButton}
        </Empty>
        {vault}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {handoffBanner}
      {intro}
      <div className="flex justify-end">{addButton}</div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Site</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last attempt</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sources.map((source) => {
            const state = emailSourceState(source);
            const { label, tone } = STATE_LABELS[state];
            const url = httpUrl(source.signupUrl);
            const canAttempt = state === "ready" || state === "failed" || state === "awaiting_confirmation" || state === "needs_person";
            return (
              <TableRow key={source.id} className="cursor-pointer" onClick={() => setEditing(source)}>
                <TableCell mobileLabel="Site" noWrapper>
                  <div className="min-w-0 text-right md:text-left">
                    <span className="block truncate font-medium text-foreground">{source.siteName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {source.source === "auto_detected" ? "Found by the engine during a search" : "Added by hand"}
                    </span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block truncate text-xs text-accent hover:text-accent-hover">
                        {url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="block truncate text-xs text-muted-foreground">{source.signupUrl}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell mobileLabel="Status">
                  <span className={cn("inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium", handoffTone(source, tone))}>
                    {source.handoffReason && state === "awaiting_confirmation" ? "No confirmation email — sign up by hand" : label}
                  </span>
                </TableCell>
                <TableCell mobileLabel="Last attempt" noWrapper>
                  <div className="min-w-0 text-right text-sm text-muted-foreground md:text-left">
                    {source.subscribedAt && state === "subscribed"
                      ? `Subscribed ${formatDateUS(source.subscribedAt, { month: "short", day: "numeric" })}`
                      : source.lastAttemptAt
                        ? formatDateUS(source.lastAttemptAt, { month: "short", day: "numeric" })
                        : "—"}
                    {(source.handoffReason ?? source.lastAttemptError) && (
                      <span className="block max-w-xs text-xs text-destructive md:truncate" title={source.handoffReason ?? source.lastAttemptError ?? undefined}>
                        {source.handoffReason ?? source.lastAttemptError}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell hideBorderMobile className="md:justify-end">
                  <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {canAttempt && (
                      <Button size="sm" loading={busyId === source.id} onClick={() => attempt(source)}>
                        <Wand2 />
                        {state === "awaiting_confirmation" ? "Retry signup" : "Attempt subscribe"}
                      </Button>
                    )}
                    {source.handoffReason && url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <ExternalLink />
                        Open signup page
                      </a>
                    )}
                    {state === "subscribed" ? (
                      <Button size="sm" variant="outline" disabled={busyId === source.id} onClick={() => setSubscribed(source, false)}>
                        Mark not subscribed
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === source.id} onClick={() => setSubscribed(source, true)}>
                        Mark subscribed
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${source.siteName}`} disabled={busyId === source.id} onClick={() => remove(source)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {vault}
    </div>
  );
}
