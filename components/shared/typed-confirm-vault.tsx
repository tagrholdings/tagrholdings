"use client";

import { useState, type MouseEvent } from "react";
import {
  Vault,
  VaultContent,
  VaultHeader,
  VaultTitle,
  VaultDescription,
  VaultForm,
  VaultField,
  VaultInput,
  VaultFooter,
  VaultPrimaryButton,
  VaultSecondaryButton,
} from "@/components/ui/vault";
import { notify } from "@/components/ui/toaster";

interface TypedConfirmVaultProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen — say plainly what is lost. */
  description: React.ReactNode;
  /** The name the person must type exactly (the workspace's name). */
  name: string;
  /** The action phrase the person must type exactly, e.g. "delete workspace". */
  phrase: string;
  confirmLabel: string;
  /** Runs the action with what was typed. Resolve on success; reject (or throw) on failure — the reason is toasted here. */
  onConfirm: (typed: { confirmName: string; confirmPhrase: string }) => Promise<{ serverError?: string; data?: unknown } | undefined>;
  /** After a successful confirm, once the vault has finished its success animation. */
  onDone?: () => void;
}

/**
 * The Vercel-style double confirmation for something hard to undo: the confirm button stays disabled until BOTH the exact
 * name and the exact action phrase are typed. The server checks them again — this is the friction, not the protection.
 */
function ConfirmForm({ name, phrase, confirmLabel, description, onConfirm, onDone, onClose }: Omit<TypedConfirmVaultProps, "open" | "onOpenChange" | "title"> & { onClose: () => void }) {
  const [typedName, setTypedName] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");
  const matches = typedName === name && typedPhrase === phrase;

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleConfirm = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!matches) return false;
    const result = await onConfirm({ confirmName: typedName, confirmPhrase: typedPhrase });
    if (!result?.data) {
      notify.error(result?.serverError ?? "That didn't work. Please try again.");
      throw new Error("typed confirmation failed");
    }
    setTimeout(() => onDone?.(), 1700);
  };

  return (
    <>
      <VaultDescription className="mb-4">{description}</VaultDescription>
      <VaultForm onSubmit={(e) => e.preventDefault()}>
        <VaultField label={<span>To confirm, type <strong className="font-semibold text-foreground">{name}</strong> below</span>}>
          <VaultInput value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" spellCheck={false} placeholder={name} />
        </VaultField>
        <VaultField label={<span>To verify, type <strong className="font-semibold text-foreground">{phrase}</strong> below</span>}>
          <VaultInput value={typedPhrase} onChange={(e) => setTypedPhrase(e.target.value)} autoComplete="off" spellCheck={false} placeholder={phrase} />
        </VaultField>
        <VaultFooter>
          <VaultSecondaryButton type="button" onClick={onClose}>
            Cancel
          </VaultSecondaryButton>
          <VaultPrimaryButton type="submit" variant="destructive" disabled={!matches} onClick={handleConfirm}>
            {confirmLabel}
          </VaultPrimaryButton>
        </VaultFooter>
      </VaultForm>
    </>
  );
}

export function TypedConfirmVault({ open, onOpenChange, title, ...rest }: TypedConfirmVaultProps) {
  return (
    <Vault open={open} onOpenChange={onOpenChange}>
      <VaultContent aria-label={title}>
        <VaultHeader>
          <VaultTitle>{title}</VaultTitle>
        </VaultHeader>
        {/* Mounted only while open, so what was typed never survives a close. */}
        {open && <ConfirmForm {...rest} onClose={() => onOpenChange(false)} />}
      </VaultContent>
    </Vault>
  );
}
