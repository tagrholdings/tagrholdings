"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Globe, Users as UsersIcon } from "lucide-react";
import { useOptimisticAction } from "next-safe-action/hooks";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { notify } from "@/components/ui/toaster";
import { initialsFor } from "@/lib/utils";
import { updateContactAction } from "@/modules/contacts/contacts.actions";
import { createOrganizationAction, updateOrganizationAction } from "@/modules/organizations/organizations.actions";
import type { ContactSummary as ContactRow } from "@/modules/contacts/contacts.types";
import type { OrganizationSummary } from "@/modules/organizations/organizations.types";
import type { ActivityRow } from "@/modules/activities/activities.types";
import type { BoardColumn, PipelineItemSummary } from "@/components/pipeline/types";
import { CreateContactVault } from "./CreateContactVault";
import { CreateOrganizationVault } from "./CreateOrganizationVault";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { OrganizationDetailPanel } from "./OrganizationDetailPanel";

export type { ContactRow };

type Tab = "people" | "organizations";

export function ContactsView({
  contacts,
  organizations: initialOrganizations,
  activities,
  pipelineItems,
  boards,
  initialTab,
  initialSelectedId,
  initialSelectedOrgId,
}: {
  contacts: ContactRow[];
  organizations: OrganizationSummary[];
  activities: ActivityRow[];
  pipelineItems: PipelineItemSummary[];
  boards: { id: string; columns: BoardColumn[] }[];
  initialTab: Tab;
  initialSelectedId: string | null;
  initialSelectedOrgId: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(initialSelectedOrgId);

  // Organizations created or edited in this session show up immediately,
  // before the revalidated server list arrives.
  const [createdOrganizations, setCreatedOrganizations] = useState<OrganizationSummary[]>([]);
  const [orgOverrides, setOrgOverrides] = useState<Record<string, Partial<OrganizationSummary>>>({});
  const organizations = [
    ...initialOrganizations,
    ...createdOrganizations.filter((o) => !initialOrganizations.some((i) => i.id === o.id)),
  ]
    .map((o) => (orgOverrides[o.id] ? { ...o, ...orgOverrides[o.id] } : o))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Names of organizations created in this session — updateFn below can run
  // before a just-created organization has made it into a re-render.
  const createdNames = useRef(new Map<string, string>());

  const { execute: updateContact, optimisticState } = useOptimisticAction(updateContactAction, {
    currentState: contacts,
    updateFn: (state, input) =>
      state.map((c) =>
        c.id === input.id && input.organizationId !== undefined
          ? {
              ...c,
              organizationId: input.organizationId,
              organizationName: input.organizationId
                ? (organizations.find((o) => o.id === input.organizationId)?.name ??
                  createdNames.current.get(input.organizationId) ??
                  null)
                : null,
            }
          : c
      ),
    onError: ({ error }) => {
      notify.error(error.serverError ?? "Couldn't update that contact. Please try again.");
    },
  });

  /** Adds an already-created organization to this session's list — used by both create paths below. */
  function registerOrganization(organization: OrganizationSummary) {
    createdNames.current.set(organization.id, organization.name);
    setCreatedOrganizations((prev) => [...prev, organization]);
  }

  /** Quick path: a picker's inline "Create ‹name›" row — name only. */
  async function createOrganization(name: string) {
    const result = await createOrganizationAction({ name });
    const organization = result?.data?.organization;
    if (!organization) {
      notify.error(result?.serverError ?? "Couldn't create that organization. Please try again.");
      return null;
    }
    registerOrganization(organization);
    notify.success(`Organization "${organization.name}" created.`);
    return organization.id;
  }

  async function saveOrganization(id: string, data: { name: string; website?: string; notes?: string }) {
    const patch = { name: data.name, website: data.website ?? null, notes: data.notes ?? null };
    setOrgOverrides((prev) => ({ ...prev, [id]: patch }));
    const result = await updateOrganizationAction({ id, ...data });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result?.serverError ?? "Couldn't update that organization. Please try again.");
      return;
    }
    notify.success("Organization updated.");
  }

  function setContactOrganization(contactId: string, organizationId: string | null) {
    updateContact({ id: contactId, organizationId });
  }

  async function createAndAssignOrganization(contactId: string, name: string) {
    const id = await createOrganization(name);
    if (id) updateContact({ id: contactId, organizationId: id });
  }

  const selected = optimisticState.find((c) => c.id === selectedId) ?? null;
  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) ?? null;

  // Per-organization counts, derived from what's already fetched — no extra query.
  const orgCounts = useMemo(() => {
    const counts: Record<string, { contacts: number; items: number }> = {};
    for (const c of optimisticState) {
      if (!c.organizationId) continue;
      (counts[c.organizationId] ??= { contacts: 0, items: 0 }).contacts += 1;
    }
    for (const item of pipelineItems) {
      if (!item.organizationId) continue;
      (counts[item.organizationId] ??= { contacts: 0, items: 0 }).items += 1;
    }
    return counts;
  }, [optimisticState, pipelineItems]);

  const createContactVault = <CreateContactVault organizations={organizations} onCreateOrganization={createOrganization} />;
  // A separate standalone entry point, not nested inside CreateContactVault's own
  // Vault — CreateOrganizationVault is itself a Vault, and nesting one Drawer
  // inside another breaks (see design.md's "Relational pickers" section; the
  // picker's own inline "Create ‹name›" row is what covers that spot instead).
  const createOrgVault = <CreateOrganizationVault variant="button" onCreated={registerOrganization} />;

  if (contacts.length === 0 && organizations.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No contacts yet</EmptyTitle>
          <EmptyDescription>Contacts and organizations you add will show up here.</EmptyDescription>
        </EmptyHeader>
        <div className="flex items-center gap-2">
          {createOrgVault}
          {createContactVault}
        </div>
      </Empty>
    );
  }

  const peopleQuery = peopleSearch.trim().toLowerCase();
  const filteredContacts = peopleQuery
    ? optimisticState.filter(
        (c) =>
          c.name.toLowerCase().includes(peopleQuery) ||
          c.email?.toLowerCase().includes(peopleQuery) ||
          c.organizationName?.toLowerCase().includes(peopleQuery)
      )
    : optimisticState;

  const orgQuery = orgSearch.trim().toLowerCase();
  const filteredOrgs = orgQuery ? organizations.filter((o) => o.name.toLowerCase().includes(orgQuery)) : organizations;

  return (
    // See components/shared/side-panel.tsx — this row is what lets opening a
    // contact's or organization's detail panel push/shrink the table instead
    // of overlaying it.
    <div className="flex min-w-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 bg-background pb-4 pt-4">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "people", label: "People", icon: UsersIcon },
              { value: "organizations", label: "Organizations", icon: Building2 },
            ]}
          />
          {tab === "people" ? (
            <SearchInput
              placeholder="Filter by name, email, or organization"
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              className="h-9"
              containerClassName="flex-1 min-w-0"
            />
          ) : (
            <SearchInput
              placeholder="Filter by organization name"
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              className="h-9"
              containerClassName="flex-1 min-w-0"
            />
          )}
          {createOrgVault}
          {createContactVault}
        </div>

        {tab === "people" ? (
          filteredContacts.length === 0 ? (
            <Empty>
              <EmptyTitle className="text-sm">
                {optimisticState.length === 0 ? "No contacts yet" : `No contacts match “${peopleSearch}”`}
              </EmptyTitle>
            </Empty>
          ) : (
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
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="cursor-pointer" onClick={() => setSelectedId(contact.id)}>
                    <TableCell mobileLabel="Name">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-alt text-xs font-semibold text-foreground">
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
          )
        ) : filteredOrgs.length === 0 ? (
          <Empty>
            <EmptyTitle className="text-sm">
              {organizations.length === 0 ? "No organizations yet" : `No organizations match “${orgSearch}”`}
            </EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Leads &amp; projects</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => {
                const counts = orgCounts[org.id];
                return (
                  <TableRow key={org.id} className="cursor-pointer" onClick={() => setSelectedOrgId(org.id)}>
                    <TableCell mobileLabel="Name">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-alt text-xs font-semibold text-foreground">
                        <Building2 className="size-3.5" />
                      </span>
                      <span className="font-medium text-foreground">{org.name}</span>
                    </TableCell>
                    <TableCell mobileLabel="Website" className="text-muted-foreground">
                      {org.website ? (
                        <>
                          <Globe className="size-3.5 shrink-0" />
                          <span className="truncate">{org.website.replace(/^https?:\/\//, "")}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell mobileLabel="Contacts" className="text-muted-foreground">
                      {counts?.contacts ?? 0}
                    </TableCell>
                    <TableCell mobileLabel="Leads & projects" className="text-muted-foreground">
                      {counts?.items ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ContactDetailPanel
        contact={selected}
        organizations={organizations}
        activities={activities}
        pipelineItems={pipelineItems}
        boards={boards}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onSetOrganization={setContactOrganization}
        onCreateOrganization={createAndAssignOrganization}
      />

      <OrganizationDetailPanel
        organization={selectedOrg}
        contacts={optimisticState}
        pipelineItems={pipelineItems}
        activities={activities}
        boards={boards}
        onOpenChange={(open) => !open && setSelectedOrgId(null)}
        onSave={saveOrganization}
      />
    </div>
  );
}
