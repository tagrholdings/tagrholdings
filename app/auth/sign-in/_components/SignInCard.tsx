"use client";

import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import { SignInForm } from "./SignInForm";

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const fieldContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const testimonialVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut", delay: 0.35 } },
};

export function SignInCard() {
  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="grid w-full max-w-4xl overflow-hidden rounded-lg bg-surface shadow-lg md:grid-cols-2"
    >
      {/* Left: logo + form */}
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:py-12">
        <motion.div variants={itemVariants} className="mb-8 flex items-center gap-2">
          <Image
            src="/brand/LogoBrand-Monocolor.png"
            alt=""
            width={100}
            height={100}
            priority
            className="h-7 w-auto object-contain"
          />
          <span className="font-serif text-lg font-semibold text-ink">
            TAGR <span className="text-accent">Holdings</span>
          </span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="font-serif text-2xl font-semibold text-ink">
          Sign in
        </motion.h1>
        <motion.p variants={itemVariants} className="mt-1 mb-8 text-sm text-muted-foreground">
          Welcome back — internal CRM access for Tagr Holdings.
        </motion.p>

        <motion.div variants={fieldContainerVariants} initial="hidden" animate="visible">
          <SignInForm fieldVariants={fieldVariants} />
        </motion.div>
      </div>

      {/* Right: illustration + testimonial, hidden below md */}
      <div className="relative hidden bg-paper-2 md:block">
        <Image
          src="/background/login-1.png"
          alt=""
          fill
          className="object-cover"
        />

        <motion.div
          variants={testimonialVariants}
          className="absolute top-6 right-6 left-6 rounded-lg border border-divider bg-surface/95 p-5 shadow-md backdrop-blur-sm"
        >
          <p className="font-serif text-base leading-snug text-ink">
            &ldquo;I wanted to build a place where good businesses — and the people who run
            them — could find the same.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Image
              src="/brand/TannerMilne.png"
              alt=""
              width={64}
              height={64}
              className="size-9 rounded-full object-cover"
            />
            <div className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              Tanner, Founder
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
