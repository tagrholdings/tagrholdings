"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { quickAddLeadAction } from "@/modules/leads/leads.actions";

/**
 * "Paste a link or some text": adds a lead by hand. One box — a lone link is fetched and read by the
 * server; anything else is taken as the text itself. The caller shows a pending row while it works
 * (`onStart`/`onFinish`), so the new lead is visible immediately and settles once extraction is done.
 *
 * Runs `quickAddLeadAction`, the Server Action twin of POST /api/leads/ingest — both call the one
 * ingestion service. tenantId comes from the session on the server; nothing here can choose it.
 */
export function QuickAddLead({
  initialValue = "",
  onStart,
  onFinish,
}: {
  initialValue?: string;
  onStart: (key: string, label: string) => void;
  onFinish: (key: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const input = value.trim();
    if (!input) return;

    const key = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onStart(key, input.length > 80 ? `${input.slice(0, 80)}…` : input);
    setValue("");
    try {
      const result = await quickAddLeadAction({ input });
      const data = result?.data;
      if (!data) {
        // Nothing was saved: put the text back so it can be retried, not retyped.
        setValue(input);
        notify.error(result?.serverError ?? "Couldn't add that lead. Please try again.");
        return;
      }
      if (data.duplicate) notify.info("That one is already in your inbox.");
      else if (!data.pageFetched) notify.info("Saved the link, but the page couldn't be read (many sites block bots). Open it and paste the text to fill in the details.", 8000);
      else if (data.extractionFallback) notify.info("Added — the AI step didn't return details this time, so only the basics are filled in.", 6000);
      else notify.success("Lead added to the inbox.");
    } catch {
      setValue(input);
      notify.error("Couldn't add that lead. Please try again.");
    } finally {
      onFinish(key);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line (pasted text is often multi-line, so this only fires on a deliberate Enter).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) void submit();
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2" aria-label="Add a lead by hand">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Paste a link or the text of a listing…"
        aria-label="Link or text of the lead to add"
        className="max-h-40 min-h-9 flex-1 resize-y py-1.5"
      />
      <Button type="submit" disabled={!value.trim()}>
        <Plus />
        Add
      </Button>
    </form>
  );
}
