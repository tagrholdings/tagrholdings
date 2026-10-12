"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { memberName } from "@/components/traction/traction-ui";
import { useWorkspacePath } from "@/hooks/ui/use-workspace-path";
import { saveVtoAction } from "@/modules/traction/traction.actions";
import { quarterLabel } from "@/modules/traction/traction.logic";
import type { IssueRow, RockRow, TractionMember, VtoContent } from "@/modules/traction/traction.types";
import { formatDateUS } from "@/utils/date";

/** The form keeps every list as one textarea, one item per line — far simpler to edit than add/remove rows. */
const formSchema = z.object({
  coreValues: z.string().max(5000),
  purpose: z.string().max(500),
  niche: z.string().max(500),
  tenYearDate: z.string().max(500),
  tenYearRevenue: z.string().max(500),
  tenYearPicture: z.string().max(500),
  targetMarket: z.string().max(500),
  uniques: z.string().max(2000),
  provenProcess: z.string().max(500),
  guarantee: z.string().max(500),
  threeYearDate: z.string().max(500),
  threeYearRevenue: z.string().max(500),
  threeYearProfit: z.string().max(500),
  threeYearMeasurables: z.string().max(500),
  threeYearPicture: z.string().max(5000),
  oneYearDate: z.string().max(500),
  oneYearRevenue: z.string().max(500),
  oneYearProfit: z.string().max(500),
  oneYearMeasurables: z.string().max(500),
  oneYearGoals: z.string().max(5000),
});
type FormValues = z.input<typeof formSchema>;

const toLines = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);

function toForm(c: VtoContent): FormValues {
  return {
    coreValues: c.coreValues.join("\n"),
    purpose: c.purpose,
    niche: c.niche,
    tenYearDate: c.tenYear.date,
    tenYearRevenue: c.tenYear.revenue,
    tenYearPicture: c.tenYear.picture,
    targetMarket: c.marketing.targetMarket,
    uniques: c.marketing.uniques.join("\n"),
    provenProcess: c.marketing.provenProcess,
    guarantee: c.marketing.guarantee,
    threeYearDate: c.threeYear.date,
    threeYearRevenue: c.threeYear.revenue,
    threeYearProfit: c.threeYear.profit,
    threeYearMeasurables: c.threeYear.measurables,
    threeYearPicture: c.threeYear.picture.join("\n"),
    oneYearDate: c.oneYear.date,
    oneYearRevenue: c.oneYear.revenue,
    oneYearProfit: c.oneYear.profit,
    oneYearMeasurables: c.oneYear.measurables,
    oneYearGoals: c.oneYear.goals.join("\n"),
  };
}

function fromForm(v: FormValues): VtoContent {
  return {
    coreValues: toLines(v.coreValues),
    purpose: v.purpose.trim(),
    niche: v.niche.trim(),
    tenYear: { date: v.tenYearDate.trim(), revenue: v.tenYearRevenue.trim(), picture: v.tenYearPicture.trim() },
    marketing: { targetMarket: v.targetMarket.trim(), uniques: toLines(v.uniques), provenProcess: v.provenProcess.trim(), guarantee: v.guarantee.trim() },
    threeYear: { date: v.threeYearDate.trim(), revenue: v.threeYearRevenue.trim(), profit: v.threeYearProfit.trim(), measurables: v.threeYearMeasurables.trim(), picture: toLines(v.threeYearPicture) },
    oneYear: { date: v.oneYearDate.trim(), revenue: v.oneYearRevenue.trim(), profit: v.oneYearProfit.trim(), measurables: v.oneYearMeasurables.trim(), goals: toLines(v.oneYearGoals) },
  };
}

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
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(content) });

  const save = handleSubmit(async (values) => {
    const result = await saveVtoAction({ content: fromForm(values) });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save the V/TO.");
      return;
    }
    notify.success("V/TO saved.");
    setEditing(false);
  });

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <p className="flex-1 text-sm text-muted-foreground">
        {updatedAt ? `Last updated ${formatDateUS(updatedAt)}.` : "Not filled in yet."} Revisit it at every quarterly.
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
          Edit
        </Button>
      )}
    </div>
  );

  return (
    <>
      {toolbar}
      <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Vision" data-tour="vto-vision">
          <Row label="Core values">
            {editing ? <Area register={register} name="coreValues" hint="One per line" /> : <List items={content.coreValues} />}
          </Row>
          <Row label="Core focus">
            <Pair label="Purpose / cause / passion">{editing ? <Field register={register} name="purpose" /> : <Text value={content.purpose} />}</Pair>
            <Pair label="Niche">{editing ? <Field register={register} name="niche" /> : <Text value={content.niche} />}</Pair>
          </Row>
          <Row label="10-year target">
            <Pair label="Date">{editing ? <Field register={register} name="tenYearDate" /> : <Text value={content.tenYear.date} />}</Pair>
            <Pair label="Revenue">{editing ? <Field register={register} name="tenYearRevenue" /> : <Text value={content.tenYear.revenue} />}</Pair>
            <Pair label="Picture">{editing ? <Field register={register} name="tenYearPicture" /> : <Text value={content.tenYear.picture} />}</Pair>
          </Row>
          <Row label="Marketing strategy">
            <Pair label="Target market">{editing ? <Field register={register} name="targetMarket" /> : <Text value={content.marketing.targetMarket} />}</Pair>
            <Pair label="Three uniques">{editing ? <Area register={register} name="uniques" hint="One per line" /> : <List items={content.marketing.uniques} ordered />}</Pair>
            <Pair label="Proven process">{editing ? <Field register={register} name="provenProcess" /> : <Text value={content.marketing.provenProcess} />}</Pair>
            <Pair label="Guarantee">{editing ? <Field register={register} name="guarantee" /> : <Text value={content.marketing.guarantee} />}</Pair>
          </Row>
        </Panel>

        <Panel title="Traction" data-tour="vto-traction">
          <Row label="3-year picture">
            <Pair label="Date">{editing ? <Field register={register} name="threeYearDate" /> : <Text value={content.threeYear.date} />}</Pair>
            <Pair label="Revenue">{editing ? <Field register={register} name="threeYearRevenue" /> : <Text value={content.threeYear.revenue} />}</Pair>
            <Pair label="Profit">{editing ? <Field register={register} name="threeYearProfit" /> : <Text value={content.threeYear.profit} />}</Pair>
            <Pair label="Measurables">{editing ? <Field register={register} name="threeYearMeasurables" /> : <Text value={content.threeYear.measurables} />}</Pair>
            <Pair label="What it looks like">{editing ? <Area register={register} name="threeYearPicture" hint="One per line" /> : <List items={content.threeYear.picture} />}</Pair>
          </Row>
          <Row label="1-year plan">
            <Pair label="Date">{editing ? <Field register={register} name="oneYearDate" /> : <Text value={content.oneYear.date} />}</Pair>
            <Pair label="Revenue">{editing ? <Field register={register} name="oneYearRevenue" /> : <Text value={content.oneYear.revenue} />}</Pair>
            <Pair label="Profit">{editing ? <Field register={register} name="oneYearProfit" /> : <Text value={content.oneYear.profit} />}</Pair>
            <Pair label="Measurables">{editing ? <Field register={register} name="oneYearMeasurables" /> : <Text value={content.oneYear.measurables} />}</Pair>
            <Pair label="Goals for the year">{editing ? <Area register={register} name="oneYearGoals" hint="One per line" /> : <List items={content.oneYear.goals} />}</Pair>
          </Row>
          <Row label={`Rocks · ${quarterLabel(quarter)}`}>
            {rocks.length === 0 ? (
              <Text value="" />
            ) : (
              <ul className="space-y-1 text-sm">
                {rocks.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>{r.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{memberName(members, r.ownerUserId) ?? "No owner"}</span>
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
    </>
  );
}

function Panel({ title, children, ...rest }: { title: string; children: ReactNode; "data-tour": string }) {
  return (
    <section {...rest} className="overflow-hidden rounded-lg border border-divider bg-surface">
      <h2 className="border-b border-divider px-4 py-3 font-serif text-lg font-semibold">{title}</h2>
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A blank field is shown as a dashed gap on purpose: an empty part of the V/TO is something to fix, not to hide. */
function Text({ value, empty = "Not defined yet" }: { value: string; empty?: string }) {
  if (!value) return <span className="inline-block rounded-sm border border-dashed border-divider px-2 py-0.5 text-sm text-muted-foreground italic">{empty}</span>;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) return <Text value="" />;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-decimal space-y-0.5 pl-5 text-sm" : "list-disc space-y-0.5 pl-5 text-sm"}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

type FieldName = keyof FormValues;

function Field({ register, name }: { register: UseFormRegister<FormValues>; name: FieldName }) {
  return <Input aria-label={name} {...register(name)} />;
}

function Area({ register, name, hint }: { register: UseFormRegister<FormValues>; name: FieldName; hint: string }) {
  return <Textarea aria-label={name} placeholder={hint} {...register(name)} />;
}
