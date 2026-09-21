"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestPortalAccessAction } from "@/modules/portal-access/portal-access.actions";

// Fixed set of landing spots: the destination comes from a URL param, so it is
// looked up here rather than used as a path.
const DESTINATIONS = {
  playbook: {
    href: "/portal",
    intro: <>open the <strong>Operating Playbook</strong> right now</>,
    button: "Open the Playbook",
    pending: "Opening playbook...",
  },
  tools: {
    href: "/portal/tools",
    intro: <>open the <strong>EOS Checkup</strong> and <strong>Urgency Index</strong> right now</>,
    button: "Open the Tools",
    pending: "Opening tools...",
  },
} as const;

export function AccessRequestForm({ destination = "playbook" }: { destination?: keyof typeof DESTINATIONS }) {
  const router = useRouter();
  const target = DESTINATIONS[destination];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await requestPortalAccessAction({ name, email });

    if (!result?.data?.success) {
      setError(result?.serverError || "Could not grant access right now. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // The action already set the access cookie, so this navigation lands
    // straight on the destination instead of another gate.
    router.push(target.href);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1220] px-4 py-12 text-[#f7f4ec]">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#2a3a56] bg-[#0e1a2e] p-8 shadow-2xl md:p-10">
        {/* Glow effect */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a03e]/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c9a03e] animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#e3c877]">
              TAGR Holdings · Private Portal
            </span>
          </div>

          <h1 className="mt-4 font-serif text-[1.85rem] font-semibold tracking-tight text-[#f7f4ec]">
            Get instant access
          </h1>

          <p className="mt-3 text-[14.5px] leading-relaxed text-[#a9b6cf]">
            Enter your details to {target.intro}. We&apos;ll also email you a private link so you can get back in later from any device.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8fa0bf]">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full rounded-md border border-[#2a3a56] bg-[#0a1220] px-4 py-2.5 text-sm text-[#f7f4ec] placeholder-[#5f6f92] outline-none transition focus:border-[#c9a03e] focus:ring-1 focus:ring-[#c9a03e]"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8fa0bf]">
                Your work email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full rounded-md border border-[#2a3a56] bg-[#0a1220] px-4 py-2.5 text-sm text-[#f7f4ec] placeholder-[#5f6f92] outline-none transition focus:border-[#c9a03e] focus:ring-1 focus:ring-[#c9a03e]"
              />
            </div>

            {error && (
              <div className="rounded-md border border-[#a84b3f]/40 bg-[#a84b3f]/10 p-3 text-xs text-[#d98a7c]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#c9a03e] px-5 py-3 font-mono text-xs uppercase tracking-wider font-semibold text-[#0a1220] transition hover:bg-[#e3c877] disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-[#0a1220]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{target.pending}</span>
                </>
              ) : (
                <span>{target.button}</span>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-[#2a3a56]/60 pt-6 text-center text-xs text-[#5f6f92]">
            Want to return to the main site?{" "}
            <Link href="/" className="font-semibold text-[#c7d2e6] hover:text-[#e3c877] underline">
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
