"use client";

import { useOptimistic, useState, useTransition, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VaultInput } from "@/components/ui/vault";
import { notify } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDateUS, parseLocalDateTime } from "@/utils/date";
import { createActivityAction, setActivityDoneAction } from "@/modules/activities/activities.actions";
import type { RockActivity } from "@/modules/traction/traction.types";

type Patch = { kind: "done"; id: string; done: boolean } | { kind: "add"; activity: RockActivity };

/**
 * A Rock's milestones and to-dos: activities linked to it (they show in Activities too, with the Rock as context).
 * Ticking one off here is the same as ticking it in Activities. A new one is a task owned by the Rock's owner.
 */
export function RockTodos({ rockId, ownerPersonId, todos: initial }: { rockId: string; ownerPersonId: string | null; todos: RockActivity[] }) {
  const [todos, apply] = useOptimistic(initial, (state, patch: Patch) =>
    patch.kind === "add" ? [...state, patch.activity] : state.map((t) => (t.id === patch.id ? { ...t, done: patch.done } : t))
  );
  const [, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [due, setDue] = useState("");

  function toggle(todo: RockActivity) {
    startTransition(async () => {
      apply({ kind: "done", id: todo.id, done: !todo.done });
      const result = await setActivityDoneAction({ id: todo.id, done: !todo.done });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  function add() {
    const title = subject.trim();
    if (!title) return;
    const dueDate = due ? parseLocalDateTime(due) : undefined;
    setSubject("");
    setDue("");
    startTransition(async () => {
      apply({ kind: "add", activity: { id: `optimistic-${crypto.randomUUID()}`, subject: title, done: false, dueDate: dueDate ?? null, rockId } });
      const result = await createActivityAction({ type: "task", subject: title, dueDate, rockId, assignedToPersonId: ownerPersonId ?? undefined });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the to-do.");
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  const done = todos.filter((t) => t.done).length;
  return (
    <section className="mb-5 space-y-2 rounded-lg border border-divider p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Milestones &amp; to-dos</h3>
        {todos.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{todos.length} done
          </span>
        )}
      </div>
      {todos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Break the Rock into the steps that get it done. They also show in Activities.</p>
      ) : (
        <ul className="space-y-1">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={todo.done}
                disabled={todo.id.startsWith("optimistic-")}
                onChange={() => toggle(todo)}
                aria-label={`Mark "${todo.subject}" ${todo.done ? "not done" : "done"}`}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className={cn("min-w-0 flex-1 truncate", todo.done ? "text-muted-foreground line-through" : "text-foreground")}>{todo.subject}</span>
              {todo.dueDate && <span className="shrink-0 text-xs text-muted-foreground">{formatDateUS(todo.dueDate, { month: "short", day: "numeric" })}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 pt-1">
        <VaultInput value={subject} onChange={(e) => setSubject(e.target.value)} onKeyDown={onKeyDown} placeholder="Add a milestone or to-do" aria-label="New to-do" className="min-w-0 flex-1" />
        <VaultInput type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="w-36 shrink-0" />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!subject.trim()} aria-label="Add to-do">
          <Plus />
        </Button>
      </div>
    </section>
  );
}
