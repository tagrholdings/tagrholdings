"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, CircleAlert, History, Pause, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/ui/pagination";
import { IssueList } from "@/components/traction/issue-list";
import { IssueVault } from "@/components/traction/issue-vaults";
import { OwnerBadge, OwnerPicker, RockStatusMenu } from "@/components/traction/traction-ui";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { setActivityDoneAction } from "@/modules/activities/activities.actions";
import { concludeMeetingAction, createIssueAction, createTodoAction, rateMeetingAction, setRockStatusAction, startMeetingAction } from "@/modules/traction/traction.actions";
import { WEEKDAYS, formatGoal, formatMeetingTime, formatValue, goalMet, percent, periodLabel, quarterLabel } from "@/modules/traction/traction.logic";
import type { EntryRow, IssueRow, LiveMeeting, MeasurableRow, MeetingRow, RockRow, RockStatus, TodoRow, TractionMember } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";
import { paginate } from "@/utils/pagination";
import { ScheduleVault } from "./ScheduleVault";

const AGENDA = [
  { key: "segue", name: "Segue", minutes: 5 },
  { key: "scorecard", name: "Scorecard", minutes: 5 },
  { key: "rocks", name: "Rock Review", minutes: 5 },
  { key: "headlines", name: "Customer / Employee Headlines", minutes: 5 },
  { key: "todos", name: "To-Do List", minutes: 5 },
  { key: "ids", name: "IDS", minutes: 60 },
  { key: "conclude", name: "Conclude", minutes: 5 },
] as const;
type StepKey = (typeof AGENDA)[number]["key"];

/** Rows per page in the To-Do step — fills its fixed-height list. */
const TODOS_PER_PAGE = 8;
/** While a meeting runs, pick up teammates' ratings from their own devices this often. */
const LIVE_REFRESH_MS = 15_000;

/** An L10 To-Do is a one-week commitment. */
const oneWeekFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** A teammate as the rating step needs them: whether they rate from their own login, or someone rates for them. */
export interface Rater {
  id: string;
  name: string;
  hasLogin: boolean;
}

export interface L10Schedule {
  weekday: number;
  startTime: string;
  timezone: string;
  nextAt: Date | string;
}

interface L10Data {
  measurables: MeasurableRow[];
  latest: EntryRow[];
  rocks: RockRow[];
  quarter: string;
  issues: IssueRow[];
  todos: TodoRow[];
  meetings: MeetingRow[];
  live: LiveMeeting | null;
  schedule: L10Schedule | null;
  members: TractionMember[];
  raters: Rater[];
  /** The viewer's team person (null for a super admin who isn't on the team). */
  mePersonId: string | null;
  isAdmin: boolean;
}

export function L10View(props: L10Data) {
  const { meetings, live, schedule, isAdmin } = props;
  const path = useWorkspacePath();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState<number[]>(() => AGENDA.map(() => 0));
  const [headlines, setHeadlines] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [starting, startStarting] = useTransition();
  const current = AGENDA[step];

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((all) => all.map((s, i) => (i === step ? s + 1 : s))), 1000);
    return () => clearInterval(timer);
  }, [running, step]);

  // Teammates rate from their own devices: keep the live meeting's ratings fresh while it runs.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, router]);

  function startMeeting() {
    startStarting(async () => {
      const result = await startMeetingAction({});
      if (result?.serverError) notify.error(result.serverError);
      else {
        setRunning(true);
        notify.success("Meeting started. Everyone can now rate it from their own device.");
      }
    });
  }

  const total = elapsed.reduce((a, b) => a + b, 0);
  const over = elapsed[step] > current.minutes * 60;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p data-tour="l10-schedule" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {schedule ? (
            <span>
              Every {WEEKDAYS[schedule.weekday]} · next: <span className="font-medium text-foreground">{formatMeetingTime(new Date(schedule.nextAt), schedule.timezone)}</span>
              {isAdmin && (
                <button type="button" onClick={() => setScheduling(true)} className="ml-2 font-medium text-accent-text hover:text-accent-hover">
                  Change
                </button>
              )}
            </span>
          ) : isAdmin ? (
            <button type="button" onClick={() => setScheduling(true)} className="font-medium text-accent-text hover:text-accent-hover">
              Set the weekly day and time
            </button>
          ) : (
            <span>No standing time yet. Ask an admin to set it.</span>
          )}
        </p>
        <Link href={path("/traction/l10/history")} data-tour="l10-history" className={buttonVariants({ variant: "outline" })}>
          <History />
          History
        </Link>
        {!live && (
          <Button data-tour="l10-start" onClick={startMeeting} loading={starting}>
            <Play />
            Start meeting
          </Button>
        )}
      </div>

      {live && <LiveBanner live={live} raters={props.raters} mePersonId={props.mePersonId} />}

      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div data-tour="l10-agenda" className="overflow-hidden rounded-lg border border-divider bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h2 className="font-serif text-base font-semibold">Agenda</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{clock(total)} / 90:00</span>
          </div>
          <ol className="no-scrollbar flex overflow-x-auto lg:block">
            {AGENDA.map((item, index) => (
              <li key={item.key} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={index === step ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 border-divider/50 px-4 py-2.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-muted lg:border-b",
                    index === step && "bg-accent/15 font-semibold",
                    index < step && "text-muted-foreground"
                  )}
                >
                  <span>{item.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{item.minutes} min</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Not overflow-hidden: the To-Do owner picker opens below the card's edge and must not be clipped. */}
        <div className="rounded-lg border border-divider bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-3">
            <div>
              <p className="label-kicker text-muted-foreground">
                Step {step + 1} of {AGENDA.length}
              </p>
              <h2 className="font-serif text-lg font-semibold">{current.name}</h2>
            </div>
            <div data-tour="l10-timer" className="flex items-center gap-2">
              <span className={cn("font-mono text-2xl tabular-nums", over && "text-destructive")}>{clock(elapsed[step])}</span>
              <span className="text-xs text-muted-foreground tabular-nums">/ {current.minutes}:00</span>
              <Button variant="outline" size="sm" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause /> : <Play />}
                {running ? "Pause" : "Start"}
              </Button>
            </div>
          </div>

          <div data-tour="l10-section" className="min-h-[240px]">
            <Section {...props} stepKey={current.key} headlines={headlines} onHeadlines={setHeadlines} onStart={startMeeting} starting={starting} onConcluded={() => setRunning(false)} />
          </div>

          <div className="flex justify-end gap-2 border-t border-divider px-4 py-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < AGENDA.length - 1 && <Button onClick={() => setStep(step + 1)}>Next: {AGENDA[step + 1].name}</Button>}
          </div>
        </div>
      </div>

      {meetings[0] && (
        <p className="text-xs text-muted-foreground">
          Last L10: {formatDateUS(meetings[0].heldAt, { month: "short", day: "numeric" })} · rating {meetings[0].averageRating ?? "—"}
        </p>
      )}
      {isAdmin && <ScheduleVault schedule={schedule} open={scheduling} onOpenChange={setScheduling} />}
    </>
  );
}

/** Shown to everyone while a meeting runs: their own rating, one tap away, from any device. */
function LiveBanner({ live, raters, mePersonId }: { live: LiveMeeting; raters: Rater[]; mePersonId: string | null }) {
  const rated = Object.keys(live.ratings).length;
  return (
    <div data-tour="l10-live" className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent/10 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
        Meeting in progress{live.startedAt ? ` since ${new Date(live.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
      </span>
      <span className="text-sm text-muted-foreground">
        {rated} of {raters.length} rated
      </span>
      <div className="flex-1" />
      {mePersonId ? <RatingPicker meetingId={live.id} personId={null} value={live.ratings[mePersonId]} label="Your rating" /> : <span className="text-xs text-muted-foreground">You aren&apos;t on this team, so you don&apos;t rate.</span>}
    </div>
  );
}

/** A 1–10 rating saved the moment it's picked. `personId: null` = the viewer rates for themselves. */
function RatingPicker({ meetingId, personId, value, label }: { meetingId: string; personId: string | null; value: number | undefined; label: string }) {
  const [rating, setRating] = useOptimistic(value, (_, next: number) => next);
  const [, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={rating ?? ""}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!next) return;
          startTransition(async () => {
            setRating(next);
            const result = await rateMeetingAction({ meetingId, personId, rating: next });
            if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't save the rating.");
          });
        }}
        className="h-8 rounded-sm border border-divider bg-surface px-2 text-sm"
      >
        <option value="">—</option>
        {Array.from({ length: 10 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SectionProps extends L10Data {
  stepKey: StepKey;
  headlines: string;
  onHeadlines: (value: string) => void;
  onStart: () => void;
  starting: boolean;
  onConcluded: () => void;
}

function Section(props: SectionProps) {
  switch (props.stepKey) {
    case "segue":
      return (
        <div className="space-y-2 p-4 text-sm">
          <p>Each person shares one personal and one professional best from the past week.</p>
          <p className="text-muted-foreground">It sets the tone and moves everyone from working in the business to working on it.</p>
        </div>
      );
    case "scorecard":
      return <ScorecardStep {...props} />;
    case "rocks":
      return <RocksStep {...props} />;
    case "headlines":
      return (
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">Good and bad news about customers and employees, one line each. Anything that needs discussion goes to Issues.</p>
          <Textarea aria-label="Headlines" placeholder={"Customer: …\nEmployee: …"} value={props.headlines} onChange={(e) => props.onHeadlines(e.target.value)} className="min-h-32" />
        </div>
      );
    case "todos":
      return <TodosStep {...props} />;
    case "ids":
      return (
        <div>
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="text-sm text-muted-foreground">Top three first, one at a time: Identify the root cause, Discuss (5–15 min), Solve.</p>
            <IssueVault
              members={props.members}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus />
                  Issue
                </Button>
              }
            />
          </div>
          <IssueList issues={props.issues} members={props.members} horizon="short_term" showClosed={false} withTimer emptyText="Nothing on the list. Short meeting!" />
        </div>
      );
    case "conclude":
      return <ConcludeStep {...props} />;
  }
}

function ScorecardStep({ measurables, latest, members }: SectionProps) {
  const [, startTransition] = useTransition();
  const year = new Date().getFullYear();
  if (measurables.length === 0) return <p className="p-4 text-sm text-muted-foreground">No measurables yet. Add them on the Scorecard page.</p>;

  function drop(m: MeasurableRow, value: number) {
    startTransition(async () => {
      const result = await createIssueAction({ title: `${m.name} off goal: ${formatValue(value, m.unit)}`, issueType: "problem", horizon: "short_term", ownerPersonId: m.ownerPersonId, measurableId: m.id });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the issue.");
      else notify.success("Dropped to Issues.");
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider">
            {["Measurable", "Who", "Goal", "Latest", ""].map((h) => (
              <th key={h} className="label-kicker px-4 py-2 text-left font-normal text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {measurables.map((m) => {
            const entry = latest.find((e) => e.measurableId === m.id);
            const met = goalMet(m, entry?.value);
            return (
              <tr key={m.id} className="border-b border-divider/50 last:border-0">
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2">
                  <OwnerBadge members={members} userId={m.ownerPersonId} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular-nums">{formatGoal(m, m.unit) ?? "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                  {entry ? (
                    <span className={cn("rounded-sm px-2 py-0.5", met === true && "bg-[color-mix(in_srgb,var(--slate)_14%,transparent)] text-green-800 dark:text-green-400", met === false && "bg-destructive/10 text-destructive")}>
                      {formatValue(entry.value, m.unit)} <span className="text-xs text-muted-foreground">{periodLabel(entry.periodStart, m.cadence, year)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not entered</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {met === false && entry && (
                    <Button variant="ghost" size="sm" onClick={() => drop(m, entry.value)}>
                      <CircleAlert />
                      Drop to Issues
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted-foreground">No discussion here: on or off. Off goes to Issues.</p>
    </div>
  );
}

function RocksStep({ rocks: initialRocks, quarter, members }: SectionProps) {
  const [rocks, setStatus] = useOptimistic(initialRocks, (state, patch: { id: string; status: RockStatus }) => state.map((r) => (r.id === patch.id ? { ...r, status: patch.status } : r)));
  const [, startTransition] = useTransition();
  const shown = rocks.filter((r) => r.status !== "rolled_over");
  if (shown.length === 0) return <p className="p-4 text-sm text-muted-foreground">No Rocks for {quarterLabel(quarter)} yet.</p>;

  function change(rock: RockRow, status: Exclude<RockStatus, "rolled_over">) {
    startTransition(async () => {
      setStatus({ id: rock.id, status });
      const result = await setRockStatusAction({ id: rock.id, status });
      if (result?.serverError) notify.error(result.serverError);
    });
  }
  function drop(rock: RockRow) {
    startTransition(async () => {
      const result = await createIssueAction({ title: `Rock off track: ${rock.title}`, issueType: "problem", horizon: "short_term", ownerPersonId: rock.ownerPersonId, rockId: rock.id });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the issue.");
      else notify.success("Dropped to Issues.");
    });
  }

  return (
    <ul>
      <li className="label-kicker px-4 pt-3 pb-1 text-muted-foreground">{quarterLabel(quarter)} · each owner says on track or off track</li>
      {shown.map((rock) => (
        <li key={rock.id} className="flex flex-wrap items-center gap-3 border-b border-divider/50 px-4 py-2.5 last:border-0">
          <span className="min-w-0 flex-1 basis-48 font-medium">
            {rock.title}
            {!rock.isCompany && <span className="ml-2 text-xs font-normal text-muted-foreground">individual</span>}
          </span>
          <OwnerBadge members={members} userId={rock.ownerPersonId} />
          {rock.status === "off_track" && (
            <Button variant="ghost" size="sm" onClick={() => drop(rock)}>
              <CircleAlert />
              Drop to Issues
            </Button>
          )}
          <RockStatusMenu status={rock.status} onChange={(s) => change(rock, s)} />
        </li>
      ))}
    </ul>
  );
}

const todoFormSchema = z.object({
  subject: z.string().trim().min(1, "Write the To-Do.").max(200),
  owner: z.string({ message: "Pick who will do it." }).min(1, "Pick who will do it."),
});
type TodoFormValues = z.input<typeof todoFormSchema>;

function TodosStep({ todos: initialTodos, members }: SectionProps) {
  const [todos, setDone] = useOptimistic(initialTodos, (state, patch: { id: string; done: boolean }) => state.map((t) => (t.id === patch.id ? { ...t, done: patch.done } : t)));
  const [, startTransition] = useTransition();
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TodoFormValues>({ resolver: zodResolver(todoFormSchema), defaultValues: { subject: "", owner: "" } });
  const done = todos.filter((t) => t.done).length;
  const [page, setPage] = useState(1);
  const slice = paginate(todos, page, TODOS_PER_PAGE);

  function toggle(todo: TodoRow) {
    startTransition(async () => {
      setDone({ id: todo.id, done: !todo.done });
      const result = await setActivityDoneAction({ id: todo.id, done: !todo.done });
      if (result?.serverError) notify.error(result.serverError);
    });
  }

  const add = handleSubmit(async (values) => {
    const result = await createTodoAction({ subject: values.subject, assignedToPersonId: values.owner, dueDate: oneWeekFromNow() });
    if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't add the To-Do.");
    else reset({ subject: "", owner: values.owner });
  });

  return (
    <div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        Done or not done, nothing in between. <span className="font-medium text-foreground tabular-nums">{percent(done, todos.length)}%</span> this week · EOS target is 90%.
      </p>
      {/* Fixed height (one page of rows), so the add form and the agenda buttons never move as the list grows. */}
      <ul className="h-[22rem] overflow-y-auto py-1">
        {todos.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">No To-Dos yet.</li>}
        {slice.items.map((todo) => (
          <li key={todo.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-muted/50">
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo)} className="size-4 accent-[var(--accent)]" />
              <span className={cn("min-w-0 flex-1 text-sm", todo.done && "text-muted-foreground line-through")}>{todo.subject}</span>
              {todo.dueDate && <span className="hidden text-xs text-muted-foreground sm:inline">{formatDateUS(todo.dueDate, { month: "short", day: "numeric" })}</span>}
              <OwnerBadge members={members} userId={todo.assignedToPersonId} compact />
            </label>
          </li>
        ))}
      </ul>
      <Pagination slice={slice} onPageChange={setPage} noun="To-Dos" className="border-t border-divider px-4 py-2" />
      <form onSubmit={add} className="flex flex-wrap items-start gap-2 border-t border-divider px-4 py-3">
        <div className="min-w-0 flex-1 basis-56">
          <Input aria-label="New To-Do" placeholder="New To-Do (due in 7 days)" {...register("subject")} aria-invalid={!!errors.subject} />
          {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject.message}</p>}
        </div>
        <div className="w-48">
          <Controller control={control} name="owner" render={({ field }) => <OwnerPicker members={members} value={field.value || null} onChange={(id) => field.onChange(id ?? "")} placeholder="Who?" required />} />
          {errors.owner && <p className="mt-1 text-xs text-destructive">{errors.owner.message}</p>}
        </div>
        <Button type="submit" loading={isSubmitting}>
          <Plus />
          Add
        </Button>
      </form>
    </div>
  );
}

function ConcludeStep({ live, raters, mePersonId, todos, rocks, measurables, latest, issues, headlines, onStart, starting, onConcluded }: SectionProps) {
  const [improvement, setImprovement] = useState("");
  const [saving, startSaving] = useTransition();
  if (!live) {
    return (
      <div className="space-y-3 p-4 text-sm">
        <p>Start the meeting so everyone can rate it from their own device, then conclude it here.</p>
        <Button onClick={onStart} loading={starting}>
          <Play />
          Start meeting
        </Button>
      </div>
    );
  }

  const values = Object.values(live.ratings);
  const average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
  const needsImprovement = average !== null && average < 8;
  const offGoal = measurables.filter((m) => goalMet(m, latest.find((e) => e.measurableId === m.id)?.value) === false).length;
  const offTrack = rocks.filter((r) => r.status === "off_track").length;
  const openIssues = issues.filter((i) => i.status === "open").length;

  function conclude() {
    startSaving(async () => {
      const result = await concludeMeetingAction({ meetingId: live!.id, headlines: headlines || null, improvement: improvement || null });
      if (result?.serverError || result?.validationErrors) notify.error(result.serverError ?? "Couldn't save the meeting.");
      else {
        onConcluded();
        notify.success("Meeting recorded. It shows in History, on the Overview and in the Portfolio.");
      }
    });
  }

  return (
    <div className="space-y-5 p-4">
      <div data-tour="l10-ratings">
        <p className="label-kicker mb-2 text-muted-foreground">Ratings, 1 to 10 · each person rates from their own device</p>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {raters.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border border-divider px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.id === mePersonId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {r.id === mePersonId ? (
                <RatingPicker meetingId={live.id} personId={null} value={live.ratings[r.id]} label="" />
              ) : !r.hasLogin ? (
                // No login of their own: whoever runs the meeting rates for them.
                <RatingPicker meetingId={live.id} personId={r.id} value={live.ratings[r.id]} label="" />
              ) : (
                <span className={cn("font-serif text-lg font-semibold tabular-nums", live.ratings[r.id] === undefined && "text-sm font-normal text-muted-foreground")}>{live.ratings[r.id] ?? "waiting"}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-divider">
        <p className="label-kicker border-b border-divider px-3 py-2 text-muted-foreground">This week, recorded at Conclude</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm sm:grid-cols-5">
          <Stat label="Avg rating" value={average === null ? "—" : String(average)} bad={needsImprovement} />
          <Stat label="To-Dos done" value={`${percent(todos.filter((t) => t.done).length, todos.length)}%`} />
          <Stat label="Off goal" value={String(offGoal)} />
          <Stat label="Rocks off track" value={String(offTrack)} />
          <Stat label="Open issues" value={String(openIssues)} />
        </dl>
      </div>

      {needsImprovement && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">The meeting averaged under 8. What would make the next one a 10?</span>
          <Textarea value={improvement} onChange={(e) => setImprovement(e.target.value)} placeholder="e.g. Start on time, keep the Scorecard to on/off" />
        </label>
      )}

      <Button onClick={conclude} loading={saving} disabled={needsImprovement && !improvement.trim()}>
        Conclude meeting
      </Button>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-serif text-xl font-semibold tabular-nums", bad && "text-destructive")}>{value}</dd>
    </div>
  );
}
