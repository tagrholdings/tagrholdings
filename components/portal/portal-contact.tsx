"use client";

import { useRef, useState } from "react";
import { sendPortalMessageAction } from "@/modules/portal-access/portal-access.actions";
import { PORTAL_CONTACT_EMAIL } from "@/modules/portal-access/portal-access.constants";
import { navContactClassName } from "@/components/shared/nav-bar";

const MAX_LENGTH = 5000;

/**
 * The portal's "Contact Us": a button in the nav that opens a message form.
 * Name and email are shown for reassurance only — the server takes the sender
 * from the access token, not from anything sent here (see
 * sendPortalMessageAction). `token` is only passed for the emailed-link case
 * where there is no cookie for the action to read.
 *
 * Uses the native <dialog>, which brings focus trapping, Esc-to-close and the
 * backdrop for free.
 */
export function PortalContact({
  name,
  email,
  token,
}: {
  name: string | null;
  email: string;
  token: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  // Runs however the dialog closed (button, backdrop, Esc). A sent message
  // shouldn't reappear next time; an unsent draft should.
  function handleClosed() {
    if (isSent) {
      setIsSent(false);
      setMessage("");
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setError(null);

    const result = await sendPortalMessageAction({ message, token: token ?? undefined });

    setIsSending(false);
    if (result?.data?.success) {
      setIsSent(true);
      return;
    }
    setError(
      result?.serverError ??
        result?.validationErrors?.message?._errors?.[0] ??
        "Could not send your message right now. Please try again."
    );
  }

  return (
    <>
      <button type="button" onClick={open} className={`${navContactClassName} cursor-pointer`}>
        Contact Us
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="portal-contact-title"
        onClose={handleClosed}
        // A click on the ::backdrop targets the dialog element itself.
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-[rgba(245,242,236,0.16)] bg-[var(--ink)] p-0 text-[var(--cream)] backdrop:bg-[rgba(27,29,31,0.6)]"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C7A667]">TAGR Holdings</p>
              <h2 id="portal-contact-title" className="mt-2 font-serif text-[1.6rem] font-medium leading-tight">
                Contact us
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-2 -mt-2 cursor-pointer p-2 font-mono text-[18px] leading-none text-[rgba(245,242,236,0.55)] transition hover:text-[#C7A667]"
            >
              ×
            </button>
          </div>

          {isSent ? (
            <div className="mt-6">
              <p className="text-[15px] leading-relaxed text-[rgba(245,242,236,0.85)]">
                Thanks — your message is on its way. We&apos;ll reply to <strong className="text-[var(--cream)]">{email}</strong>.
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-6 cursor-pointer rounded-sm bg-[#C7A667] px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)] transition hover:bg-white"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-b border-[rgba(245,242,236,0.16)] pb-5 text-[14px]">
                {name && (
                  <>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]">From</dt>
                    <dd className="text-[var(--cream)]">{name}</dd>
                  </>
                )}
                <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]">{name ? "Reply to" : "From"}</dt>
                <dd className="break-all text-[var(--cream)]">{email}</dd>
              </dl>

              <div>
                <label htmlFor="portal-contact-message" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]">
                  Message
                </label>
                <textarea
                  id="portal-contact-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (error) setError(null);
                  }}
                  maxLength={MAX_LENGTH}
                  rows={5}
                  required
                  placeholder="How can we help?"
                  className="w-full resize-none rounded-sm border border-[rgba(245,242,236,0.16)] bg-transparent px-3 py-2.5 text-[15px] text-[var(--cream)] outline-none transition placeholder:text-[rgba(245,242,236,0.35)] focus:border-[#C7A667]"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-[#f2b2b2]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSending || !message.trim()}
                className="self-start cursor-pointer rounded-sm bg-[#C7A667] px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send message"}
              </button>

              <p className="border-t border-[rgba(245,242,236,0.16)] pt-5 text-[13px] text-[rgba(245,242,236,0.55)]">
                Prefer email?{" "}
                <a href={`mailto:${PORTAL_CONTACT_EMAIL}`} className="border-b border-[#C7A667] pb-[1px] text-[var(--cream)] transition hover:text-[#C7A667]">
                  {PORTAL_CONTACT_EMAIL}
                </a>
              </p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
