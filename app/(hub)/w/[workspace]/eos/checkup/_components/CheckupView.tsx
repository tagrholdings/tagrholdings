"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { deleteCheckupAction, saveCheckupAction } from "@/modules/traction/traction.actions";
import { checkupBand, checkupScore } from "@/modules/traction/traction.logic";
import type { CheckupRow } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";

const TONE = {
  bad: "text-destructive",
  mid: "text-accent-text",
  good: "text-green-800 dark:text-green-400",
} as const;

export function CheckupView({ statements, checkups, isAdmin }: { statements: string[]; checkups: CheckupRow[]; isAdmin: boolean }) {
  const [taking, setTaking] = useState(checkups.length === 0);
  const [, startTransition] = useTransition();
  const kickoff = checkups[0];
  const latest = checkups.at(-1);

  function remove(c: CheckupRow) {
    startTransition(async () => {
      const result = await deleteCheckupAction({ id: c.id });
      if (result?.serverError) notify.error(result.serverError);
      else notify.success("Checkup deleted.");
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          The leadership team scores the company together on 20 statements, 1 (weak) to 5 (strong). Take it at kickoff, then again later — the movement is the point.
        </p>
        {!taking && (
          <Button data-tour="checkup-new" onClick={() => setTaking(true)}>
            <Plus />
            New checkup
          </Button>
        )}
      </div>

      {taking ? (
        <CheckupForm statements={statements} onDone={() => setTaking(false)} canCancel={checkups.length > 0} />
      ) : (
        <>
          {kickoff && latest && (
            <section data-tour="checkup-summary" className="grid gap-3 sm:grid-cols-3">
              <ScoreTile label={`Kickoff · ${formatDateUS(kickoff.takenAt, { month: "short", day: "numeric", year: "numeric" })}`} score={kickoff.score} />
              <ScoreTile label={`Latest · ${formatDateUS(latest.takenAt, { month: "short", day: "numeric", year: "numeric" })}`} score={latest.score} />
              <div className="rounded-lg border border-divider bg-surface px-4 py-3">
                <p className="label-kicker text-muted-foreground">Movement</p>
                <p className={cn("font-serif text-3xl font-semibold tabular-nums", latest.score - kickoff.score > 0 ? TONE.good : latest.score - kickoff.score < 0 ? TONE.bad : "")}>
                  {latest.score - kickoff.score > 0 ? "+" : ""}
                  {latest.score - kickoff.score} pts
                </p>
                <p className="text-xs text-muted-foreground">over {checkups.length} checkup{checkups.length === 1 ? "" : "s"}</p>
              </div>
            </section>
          )}

          {kickoff && latest && (
            <section data-tour="checkup-statements" className="overflow-hidden rounded-lg border border-divider bg-surface">
              <p className="label-kicker border-b border-divider px-4 py-2 text-muted-foreground">Statement by statement · kickoff → latest</p>
              <ol>
                {statements.map((s, i) => {
                  const before = kickoff.answers[i];
                  const after = latest.answers[i];
                  const delta = (after ?? 0) - (before ?? 0);
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider/50 px-4 py-2 text-sm last:border-0">
                      <span className="w-6 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span className="min-w-0 flex-1 basis-72">{s}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <Dots value={before} muted />
                        <span className="text-muted-foreground">→</span>
                        <Dots value={after} />
                        <span className={cn("w-8 text-right text-xs font-medium", delta > 0 ? TONE.good : delta < 0 ? TONE.bad : "text-muted-foreground")}>{checkups.length > 1 ? (delta > 0 ? `+${delta}` : delta || "—") : ""}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-divider bg-surface">
            <p className="label-kicker border-b border-divider px-4 py-2 text-muted-foreground">History</p>
            {checkups.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>No checkup yet</EmptyTitle>
                  <EmptyDescription>The first one is the baseline every later one is measured against.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul>
                {[...checkups].reverse().map((c, i) => {
                  const band = checkupBand(c.score);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-divider/50 px-4 py-2.5 text-sm last:border-0">
                      <span className="min-w-0 flex-1">
                        {formatDateUS(c.takenAt, { month: "short", day: "numeric", year: "numeric" })}
                        {i === checkups.length - 1 && <span className="ml-2 text-xs text-muted-foreground">kickoff</span>}
                        {c.notes && <span className="block truncate text-xs text-muted-foreground">{c.notes}</span>}
                      </span>
                      <span className={cn("text-xs", TONE[band.tone])}>{band.label}</span>
                      <span className="font-serif text-lg font-semibold tabular-nums">{c.score}%</span>
                      {isAdmin && (
                        <Button variant="ghost" size="icon-sm" aria-label="Delete this checkup" onClick={() => remove(c)}>
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ScoreTile({ label, score }: { label: string; score: number }) {
  const band = checkupBand(score);
  return (
    <div className="rounded-lg border border-divider bg-surface px-4 py-3">
      <p className="label-kicker text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl font-semibold tabular-nums">{score}%</p>
      <p className={cn("text-xs", TONE[band.tone])}>{band.label}</p>
    </div>
  );
}

/** A 1–5 answer as five small dots. */
function Dots({ value, muted = false }: { value: number | undefined; muted?: boolean }) {
  return (
    <span className="flex gap-0.5" aria-label={value ? `${value} of 5` : "not scored"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("size-2 rounded-full", value && n <= value ? (muted ? "bg-muted-foreground/60" : "bg-accent") : "bg-muted")} />
      ))}
    </span>
  );
}

const formSchema = z.object({
  answers: z.array(z.object({ value: z.number().int().min(0).max(5) })),
  notes: z.string().max(2000),
});
type FormValues = z.input<typeof formSchema>;

function CheckupForm({ statements, onDone, canCancel }: { statements: string[]; onDone: () => void; canCancel: boolean }) {
  const { control, register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { answers: statements.map(() => ({ value: 0 })), notes: "" },
  });
  const { fields } = useFieldArray({ control, name: "answers" });
  const answers = useWatch({ control, name: "answers" });
  const scored = answers.filter((a) => a.value > 0).length;
  const score = checkupScore(answers.map((a) => a.value), statements.length);
  const band = checkupBand(score);

  const save = handleSubmit(async (v) => {
    if (v.answers.some((a) => a.value === 0)) {
      notify.error(`Score all ${statements.length} statements before saving.`);
      return;
    }
    const result = await saveCheckupAction({ answers: v.answers.map((a) => a.value), notes: v.notes || null });
    if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't save the checkup.");
    else {
      notify.success(`Checkup saved: ${score}%.`);
      onDone();
    }
  });

  return (
    <form onSubmit={save} data-tour="checkup-form" className="flex flex-col gap-4">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-4 rounded-lg border border-divider bg-surface px-4 py-3 md:top-20">
        <span className="font-serif text-3xl font-semibold tabular-nums">{score}%</span>
        <span className="min-w-0 flex-1 text-sm">
          <span className={cn("block font-medium", scored ? TONE[band.tone] : "text-muted-foreground")}>{scored ? band.label : "Not started"}</span>
          <span className="block text-xs text-muted-foreground">
            {scored} of {statements.length} scored
          </span>
        </span>
        {canCancel && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} disabled={scored < statements.length}>
          Save checkup
        </Button>
      </div>
      <ol className="overflow-hidden rounded-lg border border-divider bg-surface">
        {fields.map((field, i) => (
          <li key={field.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider/50 px-4 py-3 last:border-0">
            <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0 flex-1 basis-72 text-sm">{statements[i]}</span>
            <span role="radiogroup" aria-label={`Statement ${i + 1}`} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={answers[i]?.value === n}
                  onClick={() => setValue(`answers.${i}.value`, n, { shouldDirty: true })}
                  className={cn(
                    "size-8 rounded-md border text-sm font-medium tabular-nums transition-colors",
                    answers[i]?.value === n ? "border-accent bg-accent text-ink" : "border-divider bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notes</span>
        <Textarea placeholder="Optional: who took it, what stood out" {...register("notes")} />
      </label>
    </form>
  );
}
