"use client";

import { useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/components/ui/toaster";
import { usePushNotifications, type PushStatus } from "@/hooks/notifications/usePushNotifications";
import { sendTestNotificationAction } from "@/modules/notifications/notifications.actions";

const STATUS_COPY: Record<PushStatus, string> = {
  loading: "Checking this device…",
  unsupported: "This browser can't receive push notifications.",
  "needs-install": "On iPhone and iPad, notifications only work once the CRM is added to your Home Screen.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
  off: "Off on this device.",
  on: "On for this device.",
};

/** Turn task-reminder push notifications on/off for the device you're using. */
export function NotificationsPanel() {
  const { status, busy, enable, disable } = usePushNotifications();
  const [testing, setTesting] = useState(false);
  const on = status === "on";
  const canToggle = status === "on" || status === "off";

  async function sendTest() {
    setTesting(true);
    try {
      const result = await sendTestNotificationAction({});
      if (!result?.data) notify.error(result?.serverError ?? "Couldn't send the test. Please try again.");
    } finally {
      setTesting(false);
    }
  }

  const Icon = on ? BellRing : status === "denied" || status === "unsupported" || status === "needs-install" ? BellOff : Bell;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section data-tour="notifications-toggle" className="rounded-lg border border-divider bg-surface p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold text-foreground">Push notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Get an alert with a sound when a task you marked <span className="font-medium text-foreground">Enable notification</span> reaches its due time.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground" aria-live="polite">
              {STATUS_COPY[status]}
            </p>
          </div>
          <Switch checked={on} disabled={!canToggle || busy} onCheckedChange={(next) => void (next ? enable() : disable())} aria-label="Push notifications on this device" />
        </div>

        {on && (
          <div className="mt-4 flex items-center gap-3 border-t border-divider pt-4">
            <Button variant="outline" size="sm" loading={testing} onClick={sendTest}>
              <BellRing />
              Send a test notification
            </Button>
            <span className="text-xs text-muted-foreground">You should see it — and hear it — within a few seconds.</span>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-divider bg-surface p-5 text-sm text-muted-foreground">
        <h3 className="font-serif text-base font-semibold text-foreground">How it works</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>This switch is per device: turn it on separately on your phone and on your computer.</li>
          <li>
            A task only notifies if you tick <span className="font-medium text-foreground">Enable notification</span> when creating it (it needs a due date and time).
          </li>
          <li>A task assigned to a teammate notifies that teammate; an unassigned one notifies the whole team.</li>
          <li>Reminders are checked every few minutes, so one can arrive slightly after its due time.</li>
        </ul>
      </section>
    </div>
  );
}
