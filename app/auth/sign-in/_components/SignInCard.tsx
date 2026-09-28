"use client";

import { motion, type Variants } from "framer-motion";
import { AuthShell } from "../../_components/AuthShell";
import { SignInForm } from "./SignInForm";

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
    <AuthShell title="Sign in" description="Internal CRM access for Tagr Holdings.">
      <motion.div variants={fieldContainerVariants} initial="hidden" animate="visible">
        <SignInForm fieldVariants={fieldVariants} dark />
      </motion.div>
    </AuthShell>
  );
}
