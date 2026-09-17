"use client";

import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import { SignInForm } from "./SignInForm";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const logoVariants: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const fieldContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function SignInCard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative z-10 flex w-full max-w-md flex-col items-center"
    >
      <motion.div variants={logoVariants}>
        <Image
          src="/brand/LogoBrand-Monocolor.png"
          alt="TAGR Holdings"
          width={100}
          height={100}
          priority
          className="h-16 w-auto object-contain"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mt-4 text-center font-serif text-3xl font-semibold tracking-[0.01em] text-ink"
      >
        TAGR <span className="text-accent">Holdings</span>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-3 h-0.5 w-10 rounded-full bg-accent" />

      <motion.p variants={itemVariants} className="label-kicker mt-3">
        A Private Holding Company
      </motion.p>

      <motion.div
        variants={cardVariants}
        className="mt-8 w-full rounded-lg border border-divider border-t-2 border-t-accent bg-surface p-8 shadow-lg"
      >
        <h1 className="font-serif text-xl font-semibold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">Internal CRM access</p>
        <motion.div variants={fieldContainerVariants} initial="hidden" animate="visible">
          <SignInForm fieldVariants={fieldVariants} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
