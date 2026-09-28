"use client";

import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";
import { AnimatedWaves } from "@/components/shared/animated-waves";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/**
 * The dark, wave-backed panel every pre-login page (sign-in, accept-invite) sits in: brand header, a
 * titled card holding `children`, and the confidentiality footer.
 */
export function AuthShell({
  title,
  description,
  kicker = "Secure Access",
  children,
}: {
  title: string;
  description?: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <AnimatedWaves />

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 w-full max-w-sm text-cream">
        <motion.div variants={itemVariants} className="flex flex-col items-center">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">{kicker}</p>
          <Image
            src="/brand/LogoBrand-Monocolor.png"
            alt="TAGR Holdings"
            width={100}
            height={100}
            priority
            className="mt-4 h-9 w-auto object-contain"
          />
          <div className="mt-3 font-serif text-2xl font-semibold">
            TAGR <span className="text-accent">Holdings</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-10 w-full rounded-lg border border-cream/15 bg-cream/[0.03] p-8">
          <h1 className="font-serif text-xl font-semibold">{title}</h1>
          {description && <p className="mt-1 mb-6 text-sm text-cream/55">{description}</p>}
          {children}
        </motion.div>

        <motion.p variants={itemVariants} className="mt-6 text-center font-mono text-[11px] tracking-[0.1em] text-cream/35 uppercase">
          CRM — Confidential
        </motion.p>
      </motion.div>
    </div>
  );
}
