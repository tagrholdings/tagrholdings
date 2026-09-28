"use client";

import { CheckCircle2, Download, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsStandalone } from "@/hooks/ui/use-device";
import { CURRENT_VERSION, useAppUpdate } from "@/hooks/pwa/useAppUpdate";
import { cn } from "@/lib/utils";

/**
 * The installed app's version card. Only meaningful inside the installed PWA (a normal browser tab is always
 * on the latest version after a reload), so a browser gets a short note about installing instead.
 */
export function ApplicationPanel() {
  const standalone = useIsStandalone();
  const { updateAvailable, checking, checkedAt, failed, check, applyUpdate } = useAppUpdate();

  if (!standalone) {
    return (
      <section className="flex max-w-2xl items-start gap-4 rounded-lg border border-divider bg-surface p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Installed app</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update notices show up here when you use TAGR CRM as an installed app. Add it to your home screen or install it from your browser&rsquo;s menu — in a regular browser tab, reloading the page is all it takes to get the latest version.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-2xl rounded-lg border border-divider bg-surface p-5">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            updateAvailable ? "bg-accent text-ink" : "bg-muted text-green-800 dark:text-green-400"
          )}
        >
          {updateAvailable ? <Download className="size-5" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg font-semibold text-foreground">{updateAvailable ? "Update available" : "You're up to date"}</h2>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {updateAvailable
              ? "A newer version of TAGR CRM is ready. Update now to get the latest changes — it only takes a moment."
              : "This app is running the latest version."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Version <span className="font-mono">{CURRENT_VERSION}</span>
            {checkedAt && ` · checked ${checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            {failed && " · couldn't check just now (offline?)"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        {updateAvailable && (
          <Button onClick={applyUpdate}>
            <Download />
            Update now
          </Button>
        )}
        <Button variant="outline" size="sm" loading={checking} onClick={() => void check()}>
          <RefreshCw />
          Check for updates
        </Button>
      </div>
    </section>
  );
}
