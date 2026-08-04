"use client";

import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useInView } from "framer-motion";

interface AnimatedQuoteProps {
  text: string;
  author: string;
  highlightWords?: string[];
}

const defaultHighlightWords = [
  "system",
  "structure",
  "balance",
  "success",
  "husband",
  "father",
  "business",
  "businesses",
  "people",
  "life"
];

export function AnimatedQuote({ 
  text, 
  author, 
  highlightWords = defaultHighlightWords 
}: AnimatedQuoteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const [animationComplete, setAnimationComplete] = useState(false);

  // Split text into words
  const words = text.split(" ");

  // Trigger highlight phase after the stagger animation completes
  // 70 words * 0.03s = 2.1s. We trigger it 2.3 seconds after becoming in view.
  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, 2300);
      return () => clearTimeout(timer);
    }
  }, [isInView]);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.03,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 12,
      filter: "blur(4px)",
      color: "var(--ink)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      color: "var(--ink)",
      transition: {
        duration: 0.6,
        ease: [0.215, 0.61, 0.355, 1] as const,
      },
    },
    highlighted: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      color: "#C7A667",
      transition: {
        color: { duration: 1.2, ease: "easeInOut" as const},
      },
    },
  };

  const authorVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.6,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <div ref={containerRef} className="max-w-4xl py-12 md:py-16">
      <motion.p
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="font-serif text-[clamp(1.4rem,2.8vw,2.15rem)] font-normal leading-[1.45] text-[var(--ink)] tracking-tight"
      >
        {words.map((word, idx) => {
          // Clean word to match keyword
          const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isKeyword = highlightWords.includes(cleanWord);

          return (
            <motion.span
              key={idx}
              variants={wordVariants}
              animate={animationComplete && isKeyword ? "highlighted" : undefined}
              className="inline-block mr-[0.25em]"
            >
              {word}
            </motion.span>
          );
        })}
      </motion.p>
      
      <motion.div
        variants={authorVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="mt-8 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--slate)] flex items-center gap-2"
      >
        <span>&ndash;</span>
        <span>{author}</span>
      </motion.div>
    </div>
  );
}
