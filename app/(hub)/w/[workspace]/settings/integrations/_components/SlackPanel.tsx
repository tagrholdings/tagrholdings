"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/toaster";
import { saveSlackSettingsAction } from "@/modules/slack/slack.actions";
import { slackSettingsSchema, type SlackSettingsInput } from "@/modules/slack/slack.types";

interface SlackSettings {
  server: { appId: boolean; botToken: boolean; signingSecret: boolean; gemini: boolean };
  slackTeamId: string;
  commandChannelId: string;
  linked: { slackUserId: string; name: string }[];
}

const SERVER_CHECKS: { key: keyof SlackSettings["server"]; label: string }[] = [
  { key: "appId", label: "SLACK_APP_ID" },
  { key: "signingSecret", label: "SLACK_SIGNING_SECRET" },
  { key: "botToken", label: "SLACK_BOT_TOKEN" },
  { key: "gemini", label: "GEMINI_API_KEY" },
];

export function SlackPanel({ settings }: { settings: SlackSettings }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState } = useForm<SlackSettingsInput>({
    resolver: zodResolver(slackSettingsSchema),
    defaultValues: { slackTeamId: settings.slackTeamId, commandChannelId: settings.commandChannelId },
  });

  const onSubmit = async (values: SlackSettingsInput) => {
    setSaving(true);
    try {
      const result = await saveSlackSettingsAction(values);
      if (!result?.data) notify.error(result?.serverError ?? "Couldn't save that. Please try again.");
      else notify.success("Saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form data-tour="slack-connection" onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-divider bg-surface p-5" noValidate>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold text-foreground">Slack assistant</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send the bot a message or a voice note and it fills in an activity for you to confirm. Connect your Slack workspace here, and pick the channel where every message is a command.
              Anywhere else, mention the bot.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slackTeamId">Slack workspace ID</Label>
            <Input id="slackTeamId" autoComplete="off" placeholder="T0123ABCDEF" {...register("slackTeamId")} />
            {formState.errors.slackTeamId && <p className="text-sm text-destructive">{formState.errors.slackTeamId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commandChannelId">Command channel ID</Label>
            <Input id="commandChannelId" autoComplete="off" placeholder="C0123ABCDEF" {...register("commandChannelId")} />
            {formState.errors.commandChannelId && <p className="text-sm text-destructive">{formState.errors.commandChannelId.message}</p>}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">In Slack: the workspace ID is in the workspace&rsquo;s About; for a channel, open its details and copy the ID at the bottom.</p>
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>

      <section data-tour="slack-status" className="rounded-lg border border-divider bg-surface p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Server setup</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SERVER_CHECKS.map(({ key, label }) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              {settings.server[key] ? <Check className="size-4 text-foreground" aria-hidden /> : <X className="size-4 text-destructive" aria-hidden />}
              <code>{label}</code>
              <span className="sr-only">{settings.server[key] ? "is set" : "is missing"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section data-tour="slack-people" className="rounded-lg border border-divider bg-surface p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">People who have used the bot</h2>
        <p className="mt-1 text-sm text-muted-foreground">Matched automatically by email the first time someone writes to the bot. What they create is saved as them.</p>
        {settings.linked.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nobody yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-divider">
            {settings.linked.map((person) => (
              <li key={person.slackUserId} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{person.name}</span>
                <code className="text-muted-foreground">{person.slackUserId}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
