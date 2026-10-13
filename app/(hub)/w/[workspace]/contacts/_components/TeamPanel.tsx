"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, ArchiveRestore, Link2, Link2Off, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { cn, initialsFor } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { createPersonAction, linkPersonAccountAction, setPersonArchivedAction, unlinkPersonAccountAction, updatePersonAction } from "@/modules/team/team.actions";
import type { PersonRow } from "@/modules/team/team.types";

export interface TeamTabData {
  people: PersonRow[];
  /** The workspace's logins — only sent to admins, who are the ones who can link a person to one. */
  accounts: { id: string; name: string | null; email: string }[];
  seats: { name: string; personId: string | null }[];
  isAdmin: boolean;
}

/**
 * The workspace's team: everyone who can own work — a Rock, a measurable, an issue, a To-Do — whether or not they
 * ever sign in. A person gets linked to a login automatically when someone with the same email accepts an invite;
 * an admin can also link one by hand.
 */
export function TeamPanel({ people, accounts, seats, isAdmin }: TeamTabData) {
  const [vault, setVault] = useState<{ open: boolean; person?: PersonRow }>({ open: false });
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();
  const active = people.filter((p) => !p.archivedAt);
  const archived = people.filter((p) => p.archivedAt);
  const visible = showArchived ? [...active, ...archived] : active;
  const linkedIds = new Set(people.map((p) => p.userId).filter(Boolean));
  const linkable = accounts.filter((a) => !linkedIds.has(a.id));
  const seatsOf = (id: string) => seats.filter((s) => s.personId === id).map((s) => s.name).join(", ");
  const accountOf = (userId: string | null) => accounts.find((a) => a.id === userId);

  function run(action: () => Promise<{ serverError?: string } | undefined>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result?.serverError) notify.error(result.serverError);
      else notify.success(success);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          Everyone who can own work here. A person doesn&apos;t need a login; when they accept an invite with the same email, it links on its own.
        </p>
        {archived.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
          </Button>
        )}
        <Button onClick={() => setVault({ open: true })}>
          <Plus />
          Add person
        </Button>
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Name</TableHead>
            <TableHead>Seat</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Login</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {visible.map((person) => {
            const account = accountOf(person.userId);
            return (
              <TableRow key={person.id} className={cn(person.archivedAt && "opacity-60")}>
                <TableCell mobileLabel="Name">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-alt text-xs font-semibold text-foreground">{initialsFor(person.name)}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{person.name}</span>
                    {person.title && <span className="block text-xs text-muted-foreground">{person.title}</span>}
                  </span>
                </TableCell>
                <TableCell mobileLabel="Seat" className="text-muted-foreground">
                  {seatsOf(person.id) || "No seat"}
                </TableCell>
                <TableCell mobileLabel="Email" className="text-muted-foreground">
                  {person.email ?? "—"}
                </TableCell>
                <TableCell mobileLabel="Login" className="text-muted-foreground">
                  {person.userId ? (
                    <span className="text-green-800 dark:text-green-400">Signs in{account && account.email !== person.email ? ` as ${account.email}` : ""}</span>
                  ) : (
                    "No login"
                  )}
                </TableCell>
                <TableCell mobileLabel="">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${person.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setVault({ open: true, person })}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      {isAdmin && !person.userId && linkable.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Link to a login</DropdownMenuLabel>
                          {linkable.map((a) => (
                            <DropdownMenuItem key={a.id} onSelect={() => run(() => linkPersonAccountAction({ personId: person.id, userId: a.id }), `${person.name} now signs in as ${a.email}.`)}>
                              <Link2 className="size-4" /> {a.name || a.email}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      {isAdmin && person.userId && (
                        <DropdownMenuItem onSelect={() => run(() => unlinkPersonAccountAction({ id: person.id }), "Login unlinked.")}>
                          <Link2Off className="size-4" /> Unlink login
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          run(() => setPersonArchivedAction({ id: person.id, archived: !person.archivedAt }), person.archivedAt ? `${person.name} restored.` : `${person.name} archived. What they owned keeps their name.`)
                        }
                      >
                        {person.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                        {person.archivedAt ? "Restore" : "Archive"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <PersonVault person={vault.person} open={vault.open} onOpenChange={(open) => setVault((v) => ({ ...v, open }))} />
    </div>
  );
}

const personFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.union([z.literal(""), z.email("That doesn't look like an email.")]),
  title: z.string().max(120),
});
type PersonFormValues = z.input<typeof personFormSchema>;

function PersonVault({ person, open, onOpenChange }: { person?: PersonRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const defaults = (): PersonFormValues => ({ name: person?.name ?? "", email: person?.email ?? "", title: person?.title ?? "" });
  const { register, reset, trigger, getValues, formState: { errors } } = useForm<PersonFormValues>({ resolver: zodResolver(personFormSchema), defaultValues: defaults() });

  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;
    const v = getValues();
    const payload = { name: v.name, email: v.email || null, title: v.title || null };
    const result = person ? await updatePersonAction({ id: person.id, ...payload }) : await createPersonAction(payload);
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save this person.");
      throw new Error("person save failed");
    }
  };

  return (
    <Vault open={open} onOpenChange={(next) => { if (next) reset(defaults()); onOpenChange(next); }}>
      <VaultContent aria-label={person ? "Edit person" : "Add person"}>
        <VaultHeader>
          <VaultTitle>{person ? "Edit person" : "Add person"}</VaultTitle>
        </VaultHeader>
        <VaultDescription className="mb-4">
          Someone on the team who can own Rocks, numbers, issues and To-Dos. With an email, accepting an invite later links their login on its own.
        </VaultDescription>
        <VaultForm onSubmit={(e) => e.preventDefault()}>
          <VaultField label="Name" required error={errors.name?.message}>
            <VaultInput placeholder="e.g. Rex Moreno" {...register("name")} />
          </VaultField>
          <VaultField label="Email" error={errors.email?.message}>
            <VaultInput type="email" placeholder="Optional — also where L10 reminders go" {...register("email")} />
          </VaultField>
          <VaultField label="Job title">
            <VaultInput placeholder="e.g. Lead technician" {...register("title")} />
          </VaultField>
          <VaultFooter>
            <VaultSecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </VaultSecondaryButton>
            <VaultPrimaryButton type="submit" onClick={handleSave}>
              {person ? "Save" : "Add person"}
            </VaultPrimaryButton>
          </VaultFooter>
        </VaultForm>
      </VaultContent>
    </Vault>
  );
}
