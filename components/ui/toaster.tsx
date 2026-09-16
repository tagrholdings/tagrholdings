"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toaster mínimo. O AGENTS.md manda exibir erros com `notify.error()` vindo
 * daqui, nunca com estado de erro inline (`setLocalError`).
 *
 * O store é um pub/sub de módulo (sem Context) justamente para que
 * `notify.error(...)` seja chamável de qualquer lugar, inclusive de dentro de
 * handlers que não são componentes.
 */

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

type Listener = () => void;

/** Snapshot estável: só troca de referência quando a lista realmente muda,
 *  que é o contrato exigido pelo useSyncExternalStore. */
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const EMPTY_SNAPSHOT: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastItem[] {
  return toasts;
}

function getServerSnapshot(): ToastItem[] {
  return EMPTY_SNAPSHOT;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(variant: ToastVariant, message: string, durationMs = 4500): number {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message, durationMs }];
  emit();
  return id;
}

export const notify = {
  success: (message: string, durationMs?: number) => push("success", message, durationMs),
  error: (message: string, durationMs?: number) => push("error", message, durationMs),
  info: (message: string, durationMs?: number) => push("info", message, durationMs),
  dismiss,
};

const VARIANT_STYLES: Record<ToastVariant, { wrapper: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: {
    wrapper: "bg-surface border-divider",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  error: {
    wrapper: "bg-surface border-divider",
    icon: AlertCircle,
    iconColor: "text-destructive",
  },
  info: {
    wrapper: "bg-surface border-divider",
    icon: Info,
    iconColor: "text-accent",
  },
};

function ToastRow({ item }: { item: ToastItem }) {
  const { wrapper, icon: Icon, iconColor } = VARIANT_STYLES[item.variant];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.durationMs);
    return () => clearTimeout(timer);
  }, [item.id, item.durationMs]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg",
        wrapper
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColor)} />
      <p className="flex-1 text-sm text-foreground leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Fechar aviso"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
