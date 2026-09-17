"use client";

import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import { AnimatedWaves } from "@/components/shared/animated-waves";
import { SignInForm } from "./SignInForm";

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

const fieldContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function SignInCard() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <AnimatedWaves />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-sm text-cream"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Secure Access</p>
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

        <motion.div
          variants={itemVariants}
          className="mt-10 w-full rounded-lg border border-cream/15 bg-cream/[0.03] p-8"
        >
          <h1 className="font-serif text-xl font-semibold">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-cream/55">Internal CRM access for Tagr Holdings.</p>
          <motion.div variants={fieldContainerVariants} initial="hidden" animate="visible">
            <SignInForm fieldVariants={fieldVariants} dark />
          </motion.div>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="mt-6 text-center font-mono text-[11px] tracking-[0.1em] text-cream/35 uppercase"
        >
          CRM — Confidential
        </motion.p>
      </motion.div>
    </div>
  );
}
