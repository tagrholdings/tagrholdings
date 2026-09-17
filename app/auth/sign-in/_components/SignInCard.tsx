"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SignInForm } from "./SignInForm";

export function SignInCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .from(".signin-logo", { opacity: 0, y: -12, scale: 0.9, duration: 0.5 })
        .from(".signin-wordmark", { opacity: 0, y: 6, duration: 0.4 }, "-=0.25")
        .from(
          ".signin-card",
          { opacity: 0, y: 18, scale: 0.98, duration: 0.5 },
          "-=0.2"
        )
        .from(
          ".signin-field",
          { opacity: 0, y: 10, duration: 0.35, stagger: 0.08 },
          "-=0.25"
        );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="flex w-full max-w-sm flex-col items-center">
      <Image
        src="/brand/LogoBrand-Monocolor.png"
        alt="TAGR Holdings"
        width={100}
        height={100}
        priority
        className="signin-logo h-10 w-auto object-contain"
      />
      <div className="signin-wordmark mt-3 font-serif text-lg font-semibold tracking-[0.02em] text-ink">
        TAGR <span className="text-accent">Holdings</span>
      </div>

      <div className="signin-card mt-6 w-full rounded-lg border border-divider bg-surface p-6">
        <h1 className="font-serif text-xl font-semibold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">Internal CRM access — Tagr Holdings.</p>
        <SignInForm />
      </div>
    </div>
  );
}
