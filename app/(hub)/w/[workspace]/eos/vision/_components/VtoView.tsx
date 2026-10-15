"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RockStatusPill } from "@/components/traction/traction-ui";
import { RuleChecks } from "@/components/traction/rule-checks";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { saveVtoAction } from "@/modules/traction/traction.actions";
import { formatCalendarDate, formatCompactCurrency, memberName, parseMoney, quarterLabel, type RuleCheck } from "@/modules/traction/traction.logic";
import type { IssueRow, RockRow, TractionMember, VtoContent } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";

const dateField = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Pick a date.");
const moneyField = z.string().refine((v) => v.trim() === "" || parseMoney(v) !== null, "Type an amount, like 600000 or 3M.");
const countField = z.string().refine((v) => v.trim() === "" || /^\d+$/.test(v.trim()), "A whole number.");
const text = (max = 500) => z.string().max(max);

/** Lists edit as one textarea (one item per line); core values and 1-Year goals are rows of their own. */
const formSchema = z.object({
  coreValues: z.array(z.object({ name: text(), behaviors: text(2000) })).max(10),
  purpose: text(),
  niche: text(),
  tenYearDate: dateField,
  tenYearRevenue: moneyField,
  tenYearPicture: text(),
  targetMarket: text(),
  unique1: text(),
  unique2: text(),
  unique3: text(),
  provenProcess: text(),
  guarantee: text(),
  threeYearDate: dateField,
  threeYearRevenue: moneyField,
  threeYearProfit: moneyField,
  threeYearHeadcount: countField,
  threeYearCustomers: countField,
  threeYearMeasurables: text(),
  threeYearPicture: text(5000),
  oneYearDate: dateField,
  oneYearRevenue: moneyField,
  oneYearProfit: moneyField,
  oneYearMeasurables: text(),
  oneYearBudget: text(),
  oneYearGoals: z.array(z.object({ id: z.string(), text: text() })).max(10),
});
type FormValues = z.input<typeof formSchema>;
type FieldName = Exclude<keyof FormValues, "coreValues" | "oneYearGoals">;

const toLines = (value: string) => value.split("\n").map((s) => s.trim()).filter(Boolean);
const moneyText = (n: number | null) => (n === null ? "" : String(n));
const toMoney = (v: string) => (v.trim() === "" ? null : parseMoney(v));
const toCount = (v: string) => (v.trim() === "" ? null : Number(v.trim()));

function toForm(c: VtoContent): FormValues {
  return {
    coreValues: c.coreValues.map((v) => ({ name: v.name, behaviors: v.behaviors.join("\n") })),
    purpose: c.purpose,
    niche: c.niche,
    tenYearDate: c.tenYear.date,
    tenYearRevenue: moneyText(c.tenYear.revenue),
    tenYearPicture: c.tenYear.picture,
    targetMarket: c.marketing.targetMarket,
    unique1: c.marketing.uniques[0] ?? "",
    unique2: c.marketing.uniques[1] ?? "",
    unique3: c.marketing.uniques[2] ?? "",
    provenProcess: c.marketing.provenProcess,
    guarantee: c.marketing.guarantee,
    threeYearDate: c.threeYear.date,
    threeYearRevenue: moneyText(c.threeYear.revenue),
    threeYearProfit: moneyText(c.threeYear.profit),
    threeYearHeadcount: c.threeYear.headcount === null ? "" : String(c.threeYear.headcount),
    threeYearCustomers: c.threeYear.customers === null ? "" : String(c.threeYear.customers),
    threeYearMeasurables: c.threeYear.measurables,
    threeYearPicture: c.threeYear.picture.join("\n"),
    oneYearDate: c.oneYear.date,
    oneYearRevenue: moneyText(c.oneYear.revenue),
    oneYearProfit: moneyText(c.oneYear.profit),
    oneYearMeasurables: c.oneYear.measurables,
    oneYearBudget: c.oneYear.budget,
    oneYearGoals: c.oneYear.goals.map((g) => ({ id: g.id, text: g.text })),
  };
}

function fromForm(v: FormValues): VtoContent {
  return {
    coreValues: v.coreValues.map((cv) => ({ name: cv.name.trim(), behaviors: toLines(cv.behaviors) })).filter((cv) => cv.name),
    purpose: v.purpose.trim(),
    niche: v.niche.trim(),
    tenYear: { date: v.tenYearDate, revenue: toMoney(v.tenYearRevenue), picture: v.tenYearPicture.trim() },
    marketing: { targetMarket: v.targetMarket.trim(), uniques: [v.unique1, v.unique2, v.unique3].map((u) => u.trim()).filter(Boolean), provenProcess: v.provenProcess.trim(), guarantee: v.guarantee.trim() },
    threeYear: {
      date: v.threeYearDate,
      revenue: toMoney(v.threeYearRevenue),
      profit: toMoney(v.threeYearProfit),
      headcount: toCount(v.threeYearHeadcount),
      customers: toCount(v.threeYearCustomers),
      measurables: v.threeYearMeasurables.trim(),
      picture: toLines(v.threeYearPicture),
    },
    oneYear: {
      date: v.oneYearDate,
      revenue: toMoney(v.oneYearRevenue),
      profit: toMoney(v.oneYearProfit),
      measurables: v.oneYearMeasurables.trim(),
      budget: v.oneYearBudget.trim(),
      // A new goal has no id yet; the server gives it one and keeps existing ones, so Rocks stay linked.
      goals: v.oneYearGoals.map((g) => ({ id: g.id, text: g.text.trim() })).filter((g) => g.text),
    },
  };
}

/**
 * The guided setup: the V/TO's six parts in the order EOS builds them, each with what it is and an example.
 * `done` decides where "Continue guided setup" resumes.
 */
const GUIDE_STEPS: { title: string; what: string; example: string; done: (c: VtoContent) => boolean }[] = [
  {
    title: "Core values",
    what: "3 to 7 rules that define who you are and who fits. Each one needs 2–3 behaviors you can actually see, so it can be used to hire, review and fire.",
    example: "“Own the outcome” — we finish what we start; we don't pass blame; we raise problems early.",
    done: (c) => c.coreValues.length > 0,
  },
  {
    title: "Core focus",
    what: "Why the company exists (purpose) and what it is the best at (niche). Anything outside it is a distraction.",
    example: "Purpose: help owners of great small businesses retire well. Niche: buying and growing service companies in Arizona.",
    done: (c) => !!c.purpose && !!c.niche,
  },
  {
    title: "10-year target",
    what: "One big, long-range goal everyone can rally around — a date, a number and a short picture.",
    example: "By 2036: $50M in revenue across 10 operating companies.",
    done: (c) => c.tenYear.revenue !== null || !!c.tenYear.picture,
  },
  {
    title: "Marketing strategy",
    what: "Who your ideal customer is, the three things that make you different, the name of your proven process and the promise you make.",
    example: "Target: owners aged 55+ of $2–10M service businesses in AZ. Uniques: we close fast, we keep the team, we keep the name.",
    done: (c) => !!c.marketing.targetMarket || c.marketing.uniques.length > 0,
  },
  {
    title: "3-year picture",
    what: "Where the company is in three years: revenue, profit, people and a few lines of what it looks like.",
    example: "$12M revenue, 15% profit, 80 people — 4 companies, a shared back office, an ops leader in each.",
    done: (c) => c.threeYear.revenue !== null || c.threeYear.picture.length > 0,
  },
  {
    title: "1-year plan",
    what: "This year's numbers and 3–7 goals. Every quarter's Rocks should move one of these goals.",
    example: "$5M revenue; goals: close 2 acquisitions, hire a CFO, 750 active Grounded customers.",
    done: (c) => c.oneYear.goals.length > 0,
  },
];

/** Profit as a share of revenue, when both are set — "$450K (15%)". */
function profitText(profit: number | null, revenue: number | null) {
  if (profit === null) return "";
  return revenue ? `${formatCompactCurrency(profit)} (${Math.round((profit / revenue) * 100)}%)` : formatCompactCurrency(profit);
}

/** The V/TO, read-only until "Edit". Its Rocks and Issues sections are live (from their pages), never copies. */
export function VtoView({
  content,
  updatedAt,
  quarter,
  rocks,
  longTermIssues,
  members,
  checks,
}: {
  content: VtoContent;
  updatedAt: Date | null;
  quarter: string;
  rocks: RockRow[];
  longTermIssues: IssueRow[];
  members: TractionMember[];
  checks: RuleCheck[];
}) {
  const path = useWorkspacePath();
  const [editing, setEditing] = useState(false);
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(content) });
  const f = { register, errors };

  const save = handleSubmit(async (values) => {
    const result = await saveVtoAction({ content: fromForm(values) });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the V/TO.");
      return;
    }
    notify.success("V/TO saved.");
    setEditing(false);
  });

  const rocksFor = (goalId: string) => rocks.filter((r) => r.oneYearGoalId === goalId).length;

  // A blank V/TO opens straight into the guided setup; a half-built one offers to resume where it stopped.
  const nextStep = GUIDE_STEPS.findIndex((s) => !s.done(content));
  const blank = GUIDE_STEPS.every((s) => !s.done(content));
  const [step, setStep] = useState<number | null>(blank ? 0 : null);

  const openGuide = (at: number) => {
    reset(toForm(content));
    setEditing(false);
    setStep(at);
  };

  // Each step saves the whole V/TO, so leaving halfway keeps everything written so far.
  const saveStep = handleSubmit(async (values) => {
    const result = await saveVtoAction({ content: fromForm(values) });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the V/TO.");
      return;
    }
    if (step !== null && step < GUIDE_STEPS.length - 1) setStep(step + 1);
    else {
      notify.success("Your V/TO is set up. Revisit it at every quarterly.");
      setStep(null);
    }
  });

  const stepFields = (index: number) => {
    switch (index) {
      case 0:
        return <CoreValuesEditor control={control} register={register} />;
      case 1:
        return (
          <>
            <Pair label="Purpose / cause / passion"><Field {...f} name="purpose" label="Purpose" placeholder="Why the company exists" /></Pair>
            <Pair label="Niche"><Field {...f} name="niche" label="Niche" placeholder="What you're the best at" /></Pair>
          </>
        );
      case 2:
        return (
          <>
            <Pair label="Date"><DateField {...f} name="tenYearDate" label="10-year target date" /></Pair>
            <Pair label="Revenue"><MoneyField {...f} name="tenYearRevenue" label="10-year revenue" /></Pair>
            <Pair label="Picture"><Field {...f} name="tenYearPicture" label="10-year picture" /></Pair>
          </>
        );
      case 3:
        return (
          <>
            <Pair label="Target market"><Field {...f} name="targetMarket" label="Target market" placeholder="Who, where, and the list of ideal customers" /></Pair>
            <Pair label="Three uniques">
              <div className="flex flex-col gap-2">
                <Field {...f} name="unique1" label="Unique 1" placeholder="1." />
                <Field {...f} name="unique2" label="Unique 2" placeholder="2." />
                <Field {...f} name="unique3" label="Unique 3" placeholder="3." />
              </div>
            </Pair>
            <Pair label="Proven process"><Field {...f} name="provenProcess" label="Proven process" placeholder="Its name — the steps live in EOS → Process" /></Pair>
            <Pair label="Guarantee"><Field {...f} name="guarantee" label="Guarantee" /></Pair>
          </>
        );
      case 4:
        return (
          <>
            <Pair label="Date"><DateField {...f} name="threeYearDate" label="3-year picture date" /></Pair>
            <Pair label="Revenue"><MoneyField {...f} name="threeYearRevenue" label="3-year revenue" /></Pair>
            <Pair label="Profit"><MoneyField {...f} name="threeYearProfit" label="3-year profit" /></Pair>
            <Pair label="People"><CountField {...f} name="threeYearHeadcount" label="3-year headcount" /></Pair>
            <Pair label="Customers"><CountField {...f} name="threeYearCustomers" label="3-year customers" /></Pair>
            <Pair label="Measurables"><Field {...f} name="threeYearMeasurables" label="3-year measurables" /></Pair>
            <Pair label="What it looks like"><Area {...f} name="threeYearPicture" label="3-year picture" hint="One per line" /></Pair>
          </>
        );
      default:
        return (
          <>
            <Pair label="Date"><DateField {...f} name="oneYearDate" label="1-year plan date" /></Pair>
            <Pair label="Revenue"><MoneyField {...f} name="oneYearRevenue" label="1-year revenue" /></Pair>
            <Pair label="Profit"><MoneyField {...f} name="oneYearProfit" label="1-year profit" /></Pair>
            <Pair label="Measurables"><Field {...f} name="oneYearMeasurables" label="1-year measurables" /></Pair>
            <Pair label="Budget"><Field {...f} name="oneYearBudget" label="1-year budget" /></Pair>
            <Pair label="Goals for the year (3–7)"><GoalsEditor control={control} register={register} /></Pair>
          </>
        );
    }
  };

  if (step !== null) {
    const current = GUIDE_STEPS[step];
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="label-kicker text-muted-foreground">
            Guided setup · Step {step + 1} of {GUIDE_STEPS.length}
          </p>
          <ol className="flex gap-1" aria-label="Setup progress">
            {GUIDE_STEPS.map((s, i) => (
              <li key={s.title} className="flex-1">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === step ? "step" : undefined}
                  className={cn("block h-1.5 w-full rounded-full transition-colors", i === step ? "bg-accent" : s.done(content) ? "bg-accent/40" : "bg-muted")}
                />
              </li>
            ))}
          </ol>
        </div>
        <form onSubmit={saveStep} className="overflow-hidden rounded-lg border border-divider bg-surface">
          <div className="space-y-3 border-b border-divider px-5 py-4">
            <h3 className="font-serif text-xl font-semibold">{current.title}</h3>
            <p className="text-sm text-foreground">{current.what}</p>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Example: </span>
              {current.example}
            </p>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4">{stepFields(step)}</div>
          <div className="flex flex-wrap items-center gap-2 border-t border-divider px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => setStep(null)}>
              Finish later
            </Button>
            <span className="flex-1" />
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button type="submit" loading={isSubmitting}>
              {step < GUIDE_STEPS.length - 1 ? "Save & continue" : "Save & finish"}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {nextStep !== -1 && !editing && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-foreground">
            {GUIDE_STEPS.filter((s) => s.done(content)).length} of {GUIDE_STEPS.length} parts of the V/TO are filled in. Next up: <span className="font-medium">{GUIDE_STEPS[nextStep].title}</span>.
          </p>
          <Button variant="outline" size="sm" onClick={() => openGuide(nextStep)}>
            Continue guided setup
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {updatedAt ? `Last updated ${formatDateUS(updatedAt)}.` : "Not filled in yet."} Share it with the whole company; revisit it at every quarterly.
        </p>
        {editing ? (
          <>
            <Button variant="outline" onClick={() => { reset(toForm(content)); setEditing(false); }}>
              Cancel
            </Button>
            <Button onClick={save} loading={isSubmitting}>
              Save V/TO
            </Button>
          </>
        ) : (
          <Button data-tour="vto-edit" variant="outline" onClick={() => { reset(toForm(content)); setEditing(true); }}>
            <Pencil />
            Edit V/TO
          </Button>
        )}
      </div>

      <RuleChecks checks={checks} />

      <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Vision" data-tour="vto-vision">
          <Row label="Core values">
            {editing ? (
              <CoreValuesEditor control={control} register={register} />
            ) : content.coreValues.length === 0 ? (
              <Text value="" />
            ) : (
              <ul className="space-y-2 text-sm">
                {content.coreValues.map((v) => (
                  <li key={v.name}>
                    <span className="font-medium">{v.name}</span>
                    {v.behaviors.length > 0 ? (
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {v.behaviors.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="block text-xs text-muted-foreground italic">No behaviors written yet. Write 2–3, so it can be used to hire, review and fire.</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Core focus">
            <Pair label="Purpose / cause / passion">{editing ? <Field {...f} name="purpose" label="Purpose" /> : <Text value={content.purpose} />}</Pair>
            <Pair label="Niche">{editing ? <Field {...f} name="niche" label="Niche" placeholder="What you're the best at" /> : <Text value={content.niche} />}</Pair>
          </Row>
          <Row label="10-year target">
            <Pair label="Date">{editing ? <DateField {...f} name="tenYearDate" label="10-year target date" /> : <Text value={formatCalendarDate(content.tenYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="tenYearRevenue" label="10-year revenue" /> : <Text value={formatCompactCurrency(content.tenYear.revenue)} />}</Pair>
            <Pair label="Picture">{editing ? <Field {...f} name="tenYearPicture" label="10-year picture" /> : <Text value={content.tenYear.picture} />}</Pair>
          </Row>
          <Row label="Marketing strategy">
            <Pair label="Target market">{editing ? <Field {...f} name="targetMarket" label="Target market" placeholder="Who, where, and the list of ideal customers" /> : <Text value={content.marketing.targetMarket} />}</Pair>
            <Pair label="Three uniques">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Field {...f} name="unique1" label="Unique 1" placeholder="1." />
                  <Field {...f} name="unique2" label="Unique 2" placeholder="2." />
                  <Field {...f} name="unique3" label="Unique 3" placeholder="3." />
                </div>
              ) : (
                <List items={content.marketing.uniques} ordered />
              )}
            </Pair>
            <Pair label="Proven process">{editing ? <Field {...f} name="provenProcess" label="Proven process" placeholder="Its name — the steps live in EOS → Process" /> : <Text value={content.marketing.provenProcess} />}</Pair>
            <Pair label="Guarantee">{editing ? <Field {...f} name="guarantee" label="Guarantee" /> : <Text value={content.marketing.guarantee} />}</Pair>
          </Row>
        </Panel>

        <Panel title="Traction" data-tour="vto-traction">
          <Row label="3-year picture">
            <Pair label="Date">{editing ? <DateField {...f} name="threeYearDate" label="3-year picture date" /> : <Text value={formatCalendarDate(content.threeYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="threeYearRevenue" label="3-year revenue" /> : <Text value={formatCompactCurrency(content.threeYear.revenue)} />}</Pair>
            <Pair label="Profit">{editing ? <MoneyField {...f} name="threeYearProfit" label="3-year profit" /> : <Text value={profitText(content.threeYear.profit, content.threeYear.revenue)} />}</Pair>
            <Pair label="People">{editing ? <CountField {...f} name="threeYearHeadcount" label="3-year headcount" /> : <Text value={content.threeYear.headcount === null ? "" : String(content.threeYear.headcount)} />}</Pair>
            <Pair label="Customers">{editing ? <CountField {...f} name="threeYearCustomers" label="3-year customers" /> : <Text value={content.threeYear.customers === null ? "" : content.threeYear.customers.toLocaleString("en-US")} />}</Pair>
            <Pair label="Measurables">{editing ? <Field {...f} name="threeYearMeasurables" label="3-year measurables" /> : <Text value={content.threeYear.measurables} />}</Pair>
            <Pair label="What it looks like">{editing ? <Area {...f} name="threeYearPicture" label="3-year picture" hint="One per line" /> : <List items={content.threeYear.picture} />}</Pair>
          </Row>
          <Row label="1-year plan">
            <Pair label="Date">{editing ? <DateField {...f} name="oneYearDate" label="1-year plan date" /> : <Text value={formatCalendarDate(content.oneYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="oneYearRevenue" label="1-year revenue" /> : <Text value={formatCompactCurrency(content.oneYear.revenue)} />}</Pair>
            <Pair label="Profit">{editing ? <MoneyField {...f} name="oneYearProfit" label="1-year profit" /> : <Text value={profitText(content.oneYear.profit, content.oneYear.revenue)} />}</Pair>
            <Pair label="Measurables">{editing ? <Field {...f} name="oneYearMeasurables" label="1-year measurables" /> : <Text value={content.oneYear.measurables} />}</Pair>
            <Pair label="Budget">{editing ? <Field {...f} name="oneYearBudget" label="1-year budget" /> : <Text value={content.oneYear.budget} />}</Pair>
            <Pair label="Goals for the year (3–7)">
              {editing ? (
                <GoalsEditor control={control} register={register} />
              ) : content.oneYear.goals.length === 0 ? (
                <Text value="" />
              ) : (
                <ol data-tour="vto-goals" className="list-decimal space-y-1 pl-5 text-sm">
                  {content.oneYear.goals.map((g) => {
                    const count = rocksFor(g.id);
                    return (
                      <li key={g.id}>
                        {g.text}{" "}
                        <span className={cn("text-xs", count ? "text-muted-foreground" : "text-destructive")}>
                          · {count ? `${count} Rock${count === 1 ? "" : "s"} this quarter` : "no Rock moving it"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Pair>
          </Row>
          <Row label={`Rocks · ${quarterLabel(quarter)}`}>
            {rocks.length === 0 ? (
              <Text value="" empty="No Rocks this quarter" />
            ) : (
              <ul className="space-y-1.5 text-sm">
                {rocks.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0">
                      {r.title} <span className="text-xs text-muted-foreground">· {memberName(members, r.ownerPersonId) ?? "No owner"}</span>
                    </span>
                    <RockStatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link href={path("/traction/rocks")} className="text-sm font-medium text-accent-text hover:text-accent-hover">
              Open Rocks
            </Link>
          </Row>
          <Row label="Issues list">
            {longTermIssues.length === 0 ? <Text value="" empty="No long-term issues" /> : <List items={longTermIssues.map((i) => i.rootCause || i.title)} />}
            <Link href={path("/traction/issues?list=long_term")} className="text-sm font-medium text-accent-text hover:text-accent-hover">
              Open long-term issues
            </Link>
          </Row>
        </Panel>
      </form>
    </section>
  );
}

function CoreValuesEditor({ control, register }: { control: Control<FormValues>; register: UseFormRegister<FormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "coreValues" });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">3 to 7 values, each with 2–3 behaviors you can see — so they can be used to hire, review and fire.</p>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded-md border border-divider p-3">
          <div className="flex items-center gap-2">
            <Input aria-label={`Core value ${index + 1}`} placeholder="e.g. Own the outcome" {...register(`coreValues.${index}.name` as const)} />
            <RemoveButton label="Remove core value" onClick={() => remove(index)} />
          </div>
          <Textarea aria-label={`Behaviors for value ${index + 1}`} placeholder="Behaviors, one per line" className="min-h-16" {...register(`coreValues.${index}.behaviors` as const)} />
        </div>
      ))}
      {fields.length < 10 && <AddButton label="Add core value" onClick={() => append({ name: "", behaviors: "" })} />}
    </div>
  );
}

function GoalsEditor({ control, register }: { control: Control<FormValues>; register: UseFormRegister<FormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "oneYearGoals" });
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input aria-label={`Goal ${index + 1}`} placeholder="Specific and measurable, e.g. 750 active customers" {...register(`oneYearGoals.${index}.text` as const)} />
          <RemoveButton label="Remove goal" onClick={() => remove(index)} />
        </div>
      ))}
      {fields.length < 10 && <AddButton label="Add goal" onClick={() => append({ id: "", text: "" })} />}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <X className="size-4" />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 self-start text-sm font-medium text-accent-text transition-colors hover:text-accent-hover">
      <Plus className="size-4" />
      {label}
    </button>
  );
}

function Panel({ title, children, ...rest }: { title: string; children: ReactNode; "data-tour": string }) {
  return (
    <section {...rest} className="overflow-hidden rounded-lg border border-divider bg-surface">
      <h3 className="border-b border-divider px-4 py-3 font-serif text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid border-b border-divider/50 last:border-0 sm:grid-cols-[140px_minmax(0,1fr)]">
      <p className="label-kicker border-divider/50 bg-muted/40 px-4 py-3 text-muted-foreground sm:border-r">{label}</p>
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">{children}</div>
    </div>
  );
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
      <span className="text-sm text-muted-foreground sm:pt-2">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A blank field is a dashed gap on purpose: an empty part of the V/TO is work still to do, not something to hide. */
function Text({ value, empty = "Not defined yet" }: { value: string; empty?: string }) {
  if (!value) return <span className="inline-block rounded-sm border border-dashed border-divider px-2 py-0.5 text-sm text-muted-foreground italic">{empty}</span>;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) return <Text value="" />;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-0.5 pl-5 text-sm", ordered ? "list-decimal" : "list-disc")}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

interface FieldProps {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  name: FieldName;
  label: string;
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

function Field({ register, errors, name, label, placeholder }: FieldProps & { placeholder?: string }) {
  return (
    <>
      <Input aria-label={label} placeholder={placeholder} aria-invalid={!!errors[name]} {...register(name)} />
      <ErrorText message={errors[name]?.message} />
    </>
  );
}

/** A real date picker — the V/TO's dates can only be dates. */
function DateField({ register, errors, name, label }: FieldProps) {
  return (
    <>
      <Input type="date" aria-label={label} aria-invalid={!!errors[name]} className="w-48" {...register(name)} />
      <ErrorText message={errors[name]?.message} />
    </>
  );
}

/** Dollars: a number, or shorthand like 3M / 600K. Anything else is rejected before saving. */
function MoneyField({ register, errors, name, label }: FieldProps) {
  return (
    <>
      <div className="relative w-48">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input inputMode="decimal" placeholder="600000 or 3M" aria-label={label} aria-invalid={!!errors[name]} className="pl-7" {...register(name)} />
      </div>
      <ErrorText message={errors[name]?.message} />
    </>
  );
}

function CountField({ register, errors, name, label }: FieldProps) {
  return (
    <>
      <Input inputMode="numeric" aria-label={label} aria-invalid={!!errors[name]} className="w-32" {...register(name)} />
      <ErrorText message={errors[name]?.message} />
    </>
  );
}

function Area({ register, errors, name, label, hint }: FieldProps & { hint: string }) {
  return (
    <>
      <Textarea aria-label={label} placeholder={hint} aria-invalid={!!errors[name]} {...register(name)} />
      <ErrorText message={errors[name]?.message} />
    </>
  );
}
