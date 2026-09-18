"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, Building2, ArrowUpRight } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SidePanel } from "@/components/shared/side-panel";
import { Button } from "@/components/ui/button";
import { initialsFor } from "@/lib/utils";

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

export function ContactsView({ contacts }: { contacts: ContactRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  if (contacts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No contacts yet</EmptyTitle>
          <EmptyDescription>Contacts you add will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <tr>
            <TableHead>Name</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="cursor-pointer"
              onClick={() => setSelectedId(contact.id)}
            >
              <TableCell mobileLabel="Name">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground">
                  {initialsFor(contact.name)}
                </span>
                <span className="font-medium text-foreground">{contact.name}</span>
              </TableCell>
              <TableCell mobileLabel="Organization" className="text-muted-foreground">
                {contact.organizationName ?? "—"}
              </TableCell>
              <TableCell mobileLabel="Email" className="text-muted-foreground">
                {contact.email ?? "—"}
              </TableCell>
              <TableCell mobileLabel="Phone" className="text-muted-foreground">
                {contact.phone ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SidePanel
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.name ?? ""}
        description={selected?.organizationName ?? undefined}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                {initialsFor(selected.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-semibold text-foreground">{selected.name}</p>
                {selected.organizationName && (
                  <p className="truncate text-sm text-muted-foreground">{selected.organizationName}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-divider bg-background p-4 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                {selected.email ?? <span className="text-muted-foreground">No email on file</span>}
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {selected.phone ?? <span className="text-muted-foreground">No phone on file</span>}
              </div>
            </div>

            <Button render={<Link href={`/contacts/${selected.id}`} />} className="w-full">
              Go to full profile
              <ArrowUpRight />
            </Button>
          </div>
        )}
      </SidePanel>
    </>
  );
}
