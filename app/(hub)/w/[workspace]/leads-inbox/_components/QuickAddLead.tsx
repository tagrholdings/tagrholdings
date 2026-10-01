"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { MOBILE_GHOST } from "@/components/layout/page-slots";
import {
  Vault,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultDescription,
  VaultForm,
  VaultField,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { quickAddLeadAction } from "@/modules/leads/leads.actions";

/**
 * "Add lead": a button that opens a Vault to add a lead by hand. One box — a lone link is fetched and
 * read by the server; anything else is taken as the text itself. The Vault closes as soon as it's sent;
 * the caller shows a pending row while the server works (`onStart`/`onFinish`), so the new lead is
 * visible immediately and settles once extraction is done. If nothing was saved, the Vault reopens
 * with the text put back, so it can be retried instead of retyped.
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
  // The text lives here, not inside the Vault, so it survives the Vault closing on send and can be restored on failure.
  const [value, setValue] = useState(initialValue);
  // Opens by itself when text arrives from the PWA share target (/leads-inbox?add=…).
  const [open, setOpen] = useState(initialValue.trim() !== "");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const input = value.trim();
    if (!input) return;

    const key = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onStart(key, input.length > 80 ? `${input.slice(0, 80)}…` : input);
    setValue("");
    setOpen(false);

    const putBack = (message: string) => {
      setValue(input);
      setOpen(true);
      notify.error(message);
    };

    try {
      const result = await quickAddLeadAction({ input });
      const data = result?.data;
      if (!data) {
        // Nothing was saved.
        putBack(result?.serverError ?? "Couldn't add that lead. Please try again.");
        return;
      }
      if (data.duplicate) notify.info("That one is already in your inbox.");
      else if (!data.pageFetched) notify.info("Saved the link, but the page couldn't be read (many sites block bots). Open it and paste the text to fill in the details.", 8000);
      else if (data.extractionFallback) notify.info("Added — the AI step didn't return details this time, so only the basics are filled in.", 6000);
      else notify.success("Lead added to the inbox.");
    } catch {
      putBack("Couldn't add that lead. Please try again.");
    } finally {
      onFinish(key);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line (pasted text is often multi-line, so this only fires on a deliberate Enter).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) void submit();
  }

  return (
    <>
      <Button data-tour="leads-inbox-add" className={MOBILE_GHOST} onClick={() => setOpen(true)}>
        <Plus />
        <span className="hidden sm:inline">Add lead</span>
      </Button>

      <Vault open={open} onOpenChange={setOpen}>
        <VaultContent aria-label="Add a lead by hand">
          <VaultHeader>
            <VaultTitle>Add a lead</VaultTitle>
            <VaultDescription>Paste a link or the text of a listing — the details are filled in for you.</VaultDescription>
          </VaultHeader>
          <VaultForm onSubmit={submit}>
            <VaultField>
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                rows={6}
                placeholder="Paste a link or the text of a listing…"
                aria-label="Link or text of the lead to add"
                className="max-h-64 resize-y"
              />
            </VaultField>
            <VaultFooter>
              <VaultSecondaryButton type="button" onClick={() => setOpen(false)}>
                Cancel
              </VaultSecondaryButton>
              {/* No onClick: it just submits the form. Closing is handled in submit(), not by the button's success animation. */}
              <VaultPrimaryButton type="submit" disabled={!value.trim()}>
                <Plus className="size-4" />
                Add
              </VaultPrimaryButton>
            </VaultFooter>
          </VaultForm>
        </VaultContent>
      </Vault>
    </>
  );
}
