"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm, type FieldError, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RockStatusPill } from "@/components/traction/traction-ui";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { saveVtoAction } from "@/modules/traction/traction.actions";
import { formatCalendarDate, formatCompactCurrency, memberName, parseMoney, quarterLabel } from "@/modules/traction/traction.logic";
import type { IssueRow, RockRow, TractionMember, VtoContent } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";

const dateField = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Pick a date.");
const moneyField = z.string().refine((v) => v.trim() === "" || parseMoney(v) !== null, "Type an amount, like 600000 or 3M.");
const text = (max = 500) => z.string().max(max);

/** Lists edit as one textarea (one item per line), except the three uniques, which get a field each. */
const formSchema = z.object({
  coreValues: text(5000),
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
  threeYearMeasurables: text(),
  threeYearPicture: text(5000),
  oneYearDate: dateField,
  oneYearRevenue: moneyField,
  oneYearProfit: moneyField,
  oneYearMeasurables: text(),
  oneYearGoals: text(5000),
});
type FormValues = z.input<typeof formSchema>;
type FieldName = keyof FormValues;

const toLines = (value: string) => value.split("\n").map((s) => s.trim()).filter(Boolean);
const moneyText = (n: number | null) => (n === null ? "" : String(n));
const toMoney = (v: string) => (v.trim() === "" ? null : parseMoney(v));

function toForm(c: VtoContent): FormValues {
  return {
    coreValues: c.coreValues.join("\n"),
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
    threeYearMeasurables: c.threeYear.measurables,
    threeYearPicture: c.threeYear.picture.join("\n"),
    oneYearDate: c.oneYear.date,
    oneYearRevenue: moneyText(c.oneYear.revenue),
    oneYearProfit: moneyText(c.oneYear.profit),
    oneYearMeasurables: c.oneYear.measurables,
    oneYearGoals: c.oneYear.goals.join("\n"),
  };
}

function fromForm(v: FormValues): VtoContent {
  return {
    coreValues: toLines(v.coreValues),
    purpose: v.purpose.trim(),
    niche: v.niche.trim(),
    tenYear: { date: v.tenYearDate, revenue: toMoney(v.tenYearRevenue), picture: v.tenYearPicture.trim() },
    marketing: { targetMarket: v.targetMarket.trim(), uniques: [v.unique1, v.unique2, v.unique3].map((u) => u.trim()).filter(Boolean), provenProcess: v.provenProcess.trim(), guarantee: v.guarantee.trim() },
    threeYear: { date: v.threeYearDate, revenue: toMoney(v.threeYearRevenue), profit: toMoney(v.threeYearProfit), measurables: v.threeYearMeasurables.trim(), picture: toLines(v.threeYearPicture) },
    oneYear: { date: v.oneYearDate, revenue: toMoney(v.oneYearRevenue), profit: toMoney(v.oneYearProfit), measurables: v.oneYearMeasurables.trim(), goals: toLines(v.oneYearGoals) },
  };
}

/** The V/TO, read-only until "Edit". Its Rocks and Issues sections are live (from their pages), never copies. */
export function VtoView({
  content,
  updatedAt,
  quarter,
  rocks,
  longTermIssues,
  members,
}: {
  content: VtoContent;
  updatedAt: Date | null;
  quarter: string;
  rocks: RockRow[];
  longTermIssues: IssueRow[];
  members: TractionMember[];
}) {
  const path = useWorkspacePath();
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(content) });
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

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg font-semibold">Vision / Traction Organizer</h2>
          <p className="text-sm text-muted-foreground">
            {updatedAt ? `Last updated ${formatDateUS(updatedAt)}.` : "Not filled in yet."} Revisit it at every quarterly.
          </p>
        </div>
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

      <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Vision" data-tour="vto-vision">
          <Row label="Core values">{editing ? <Area {...f} name="coreValues" label="Core values" hint="One per line" /> : <List items={content.coreValues} />}</Row>
          <Row label="Core focus">
            <Pair label="Purpose / cause / passion">{editing ? <Field {...f} name="purpose" label="Purpose" /> : <Text value={content.purpose} />}</Pair>
            <Pair label="Niche">{editing ? <Field {...f} name="niche" label="Niche" /> : <Text value={content.niche} />}</Pair>
          </Row>
          <Row label="10-year target">
            <Pair label="Date">{editing ? <DateField {...f} name="tenYearDate" label="10-year target date" /> : <Text value={formatCalendarDate(content.tenYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="tenYearRevenue" label="10-year revenue" /> : <Text value={formatCompactCurrency(content.tenYear.revenue)} />}</Pair>
            <Pair label="Picture">{editing ? <Field {...f} name="tenYearPicture" label="10-year picture" /> : <Text value={content.tenYear.picture} />}</Pair>
          </Row>
          <Row label="Marketing strategy">
            <Pair label="Target market">{editing ? <Field {...f} name="targetMarket" label="Target market" /> : <Text value={content.marketing.targetMarket} />}</Pair>
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
            <Pair label="Proven process">{editing ? <Field {...f} name="provenProcess" label="Proven process" /> : <Text value={content.marketing.provenProcess} />}</Pair>
            <Pair label="Guarantee">{editing ? <Field {...f} name="guarantee" label="Guarantee" /> : <Text value={content.marketing.guarantee} />}</Pair>
          </Row>
        </Panel>

        <Panel title="Traction" data-tour="vto-traction">
          <Row label="3-year picture">
            <Pair label="Date">{editing ? <DateField {...f} name="threeYearDate" label="3-year picture date" /> : <Text value={formatCalendarDate(content.threeYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="threeYearRevenue" label="3-year revenue" /> : <Text value={formatCompactCurrency(content.threeYear.revenue)} />}</Pair>
            <Pair label="Profit">{editing ? <MoneyField {...f} name="threeYearProfit" label="3-year profit" /> : <Text value={formatCompactCurrency(content.threeYear.profit)} />}</Pair>
            <Pair label="Measurables">{editing ? <Field {...f} name="threeYearMeasurables" label="3-year measurables" /> : <Text value={content.threeYear.measurables} />}</Pair>
            <Pair label="What it looks like">{editing ? <Area {...f} name="threeYearPicture" label="3-year picture" hint="One per line" /> : <List items={content.threeYear.picture} />}</Pair>
          </Row>
          <Row label="1-year plan">
            <Pair label="Date">{editing ? <DateField {...f} name="oneYearDate" label="1-year plan date" /> : <Text value={formatCalendarDate(content.oneYear.date)} />}</Pair>
            <Pair label="Revenue">{editing ? <MoneyField {...f} name="oneYearRevenue" label="1-year revenue" /> : <Text value={formatCompactCurrency(content.oneYear.revenue)} />}</Pair>
            <Pair label="Profit">{editing ? <MoneyField {...f} name="oneYearProfit" label="1-year profit" /> : <Text value={formatCompactCurrency(content.oneYear.profit)} />}</Pair>
            <Pair label="Measurables">{editing ? <Field {...f} name="oneYearMeasurables" label="1-year measurables" /> : <Text value={content.oneYear.measurables} />}</Pair>
            <Pair label="Goals for the year">{editing ? <Area {...f} name="oneYearGoals" label="Goals for the year" hint="One per line" /> : <List items={content.oneYear.goals} />}</Pair>
          </Row>
          <Row label={`Rocks · ${quarterLabel(quarter)}`}>
            {rocks.length === 0 ? (
              <Text value="" empty="No Rocks this quarter" />
            ) : (
              <ul className="space-y-1.5 text-sm">
                {rocks.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0">
                      {r.title} <span className="text-xs text-muted-foreground">· {memberName(members, r.ownerUserId) ?? "No owner"}</span>
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
            {longTermIssues.length === 0 ? <Text value="" empty="No long-term issues" /> : <List items={longTermIssues.map((i) => i.title)} />}
            <Link href={path("/traction/issues?list=long_term")} className="text-sm font-medium text-accent-text hover:text-accent-hover">
              Open long-term issues
            </Link>
          </Row>
        </Panel>
      </form>
    </section>
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
  errors: Partial<Record<FieldName, FieldError>>;
  name: FieldName;
  label: string;
}

function ErrorText({ error }: { error?: FieldError }) {
  return error?.message ? <p className="mt-1 text-xs text-destructive">{error.message}</p> : null;
}

function Field({ register, errors, name, label, placeholder }: FieldProps & { placeholder?: string }) {
  return (
    <>
      <Input aria-label={label} placeholder={placeholder} aria-invalid={!!errors[name]} {...register(name)} />
      <ErrorText error={errors[name]} />
    </>
  );
}

/** A real date picker — the V/TO's dates can only be dates. */
function DateField({ register, errors, name, label }: FieldProps) {
  return (
    <>
      <Input type="date" aria-label={label} aria-invalid={!!errors[name]} className="w-48" {...register(name)} />
      <ErrorText error={errors[name]} />
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
      <ErrorText error={errors[name]} />
    </>
  );
}

function Area({ register, errors, name, label, hint }: FieldProps & { hint: string }) {
  return (
    <>
      <Textarea aria-label={label} placeholder={hint} aria-invalid={!!errors[name]} {...register(name)} />
      <ErrorText error={errors[name]} />
    </>
  );
}
