"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import { TypedConfirmVault } from "@/components/shared/typed-confirm-vault";
import { archiveWorkspaceAction, deleteWorkspaceAction, unarchiveWorkspaceAction } from "@/modules/tenancy/tenancy.actions";
import { ARCHIVE_PHRASE, DELETE_PHRASE } from "@/modules/tenancy/tenancy.types";

function Row({ title, children, action }: { title: string; children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Archive (reversible) and delete (not) — each behind a double confirmation: the workspace's exact name AND the action
 * phrase, typed, like Vercel. The server checks both again.
 */
export function DangerZone({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function restore() {
    setRestoring(true);
    try {
      const result = await unarchiveWorkspaceAction({ id });
      if (!result?.data) notify.error(result?.serverError ?? "Couldn't restore that workspace.");
      else {
        notify.success("Workspace restored.");
        router.refresh();
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-destructive/40">
      <h2 className="border-b border-destructive/40 bg-destructive/5 px-5 py-3 font-serif text-lg font-semibold text-destructive">Danger zone</h2>
      <div className="divide-y divide-divider bg-surface">
        {archived ? (
          <Row
            title="Restore this workspace"
            action={
              <Button variant="outline" onClick={restore} loading={restoring}>
                Restore workspace
              </Button>
            }
          >
            Members can open it again and its jobs (lead engine, reminders, inbound email) resume.
          </Row>
        ) : (
          <Row
            title="Archive this workspace"
            action={
              <Button variant="outline" onClick={() => setDialog("archive")}>
                Archive workspace
              </Button>
            }
          >
            Closes it to its members and stops the lead engine, reminders and inbound email for it. Nothing is deleted, and you can restore it any time.
          </Row>
        )}
        <Row
          title="Delete this workspace"
          action={
            <Button variant="destructive" onClick={() => setDialog("delete")}>
              Delete workspace
            </Button>
          }
        >
          Permanently deletes the workspace and everything in it &mdash; leads, projects, activities, contacts, search profiles and invites. This can&rsquo;t be undone.
        </Row>
      </div>

      <TypedConfirmVault
        open={dialog === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Archive workspace"
        description={
          <>
            <strong>{name}</strong> will be closed to its members and every job will skip it. Nothing is deleted &mdash; you can restore it from this page.
          </>
        }
        name={name}
        phrase={ARCHIVE_PHRASE}
        confirmLabel="Archive workspace"
        onConfirm={(typed) => archiveWorkspaceAction({ id, ...typed })}
        onDone={() => router.refresh()}
      />
      <TypedConfirmVault
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Delete workspace"
        description={
          <>
            This permanently deletes <strong>{name}</strong> and <strong>all of its data</strong>: leads, projects, activities, contacts, search profiles and invites. People&rsquo;s accounts are
            not deleted, but they lose access to this workspace. This can&rsquo;t be undone.
          </>
        }
        name={name}
        phrase={DELETE_PHRASE}
        confirmLabel="Delete workspace"
        onConfirm={(typed) => deleteWorkspaceAction({ id, ...typed })}
        onDone={() => router.push("/admin")}
      />
    </section>
  );
}
