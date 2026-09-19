"use client";

import type { MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { notify } from "@/components/ui/toaster";
import { createSearchProfileAction, updateSearchProfileAction } from "@/modules/search-profiles/search-profiles.actions";
import { DEFAULT_PROFILE_SOURCES, type ProfileSources } from "@/modules/search-profiles/search-profiles.schema";
import type { SearchProfileSummary } from "@/modules/search-profiles/search-profiles.types";

const money = z.number({ error: "Enter a number." }).min(0, "Can't be negative.").max(1_000_000_000_000).optional();
const count = z.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(0, "Can't be negative.").max(1_000_000).optional();

/** A number box that's blank means "no requirement" (undefined), not 0 and not NaN. */
const optionalNumber = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v)) };

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  category: z.string().trim().min(1, "Category is required.").max(100),
  keywordsText: z.string().max(1600),
  city: z.string().trim().min(1, "City is required.").max(100),
  state: z.string().trim().min(2, "State is required.").max(50),
  radiusMiles: z.number({ error: "Enter a number." }).int().min(1, "At least 1 mile.").max(500, "Up to 500 miles."),
  maxLeadsPerRun: z.number({ error: "Enter a number." }).int().min(1, "At least 1.").max(200, "Up to 200."),
  frequencyHours: z.number({ error: "Enter a number." }).int().min(1, "At least 1 hour.").max(720, "Up to 720 hours."),
  // Qualification criteria: every box optional; blank -> undefined (see optionalNumber below).
  minRevenue: money,
  maxRevenue: money,
  minProfit: money,
  maxProfit: money,
  maxAskingPrice: money,
  minEmployees: count,
  maxEmployees: count,
  minYearsInBusiness: count,
  signalKeywordsText: z.string().max(1500),
  sources: z.object({
    google_places: z.boolean(),
    brave_search: z.boolean(),
    company_site_scrape: z.boolean(),
    marketplace_scrape: z.boolean(),
  }),
}).superRefine((v, ctx) => {
  const pairs = [
    ["minRevenue", "maxRevenue", "revenue"],
    ["minProfit", "maxProfit", "profit"],
    ["minEmployees", "maxEmployees", "employees"],
  ] as const;
  for (const [lo, hi, label] of pairs) {
    const min = v[lo];
    const max = v[hi];
    if (min !== undefined && max !== undefined && min > max) {
      ctx.addIssue({ code: "custom", path: [hi], message: `Max ${label} must be at least the minimum.` });
    }
  }
});

type FormValues = z.input<typeof formSchema>;

const SOURCE_OPTIONS: { key: keyof ProfileSources; label: string; hint: string }[] = [
  { key: "google_places", label: "Google Places", hint: "Finds local businesses by category and area." },
  { key: "brave_search", label: "Brave Search", hint: "Finds company websites by keyword (Brave Search API)." },
  { key: "marketplace_scrape", label: "Marketplaces", hint: "“Businesses for sale” listings, e.g. BizBuySell." },
  { key: "company_site_scrape", label: "Company websites", hint: "Reads each business's own site for contact details. Adds no new leads by itself." },
];

function parseKeywords(text: string) {
  return text
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function ProfileForm({ profile, onClose }: { profile: SearchProfileSummary | null; onClose: () => void }) {
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: profile?.name ?? "",
      category: profile?.category ?? "",
      keywordsText: profile?.keywords.join(", ") ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      radiusMiles: profile?.radiusMiles ?? 25,
      maxLeadsPerRun: profile?.maxLeadsPerRun ?? 25,
      frequencyHours: profile?.frequencyHours ?? 24,
      minRevenue: profile?.criteria?.minRevenue,
      maxRevenue: profile?.criteria?.maxRevenue,
      minProfit: profile?.criteria?.minProfit,
      maxProfit: profile?.criteria?.maxProfit,
      maxAskingPrice: profile?.criteria?.maxAskingPrice,
      minEmployees: profile?.criteria?.minEmployees,
      maxEmployees: profile?.criteria?.maxEmployees,
      minYearsInBusiness: profile?.criteria?.minYearsInBusiness,
      signalKeywordsText: profile?.criteria?.signalKeywords?.join(", ") ?? "",
      sources: profile?.sources ?? DEFAULT_PROFILE_SOURCES,
    },
  });

  // VaultPrimaryButton contract — see the end of components/ui/vault.tsx.
  const handleSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!(await trigger())) return false;

    const values = getValues();
    const data = {
      name: values.name.trim(),
      category: values.category.trim(),
      keywords: parseKeywords(values.keywordsText),
      city: values.city.trim(),
      state: values.state.trim(),
      radiusMiles: values.radiusMiles,
      maxLeadsPerRun: values.maxLeadsPerRun,
      frequencyHours: values.frequencyHours,
      sources: values.sources,
      // Always sent (even when empty) so clearing every box on an edit clears the stored criteria.
      criteria: {
        minRevenue: values.minRevenue,
        maxRevenue: values.maxRevenue,
        minProfit: values.minProfit,
        maxProfit: values.maxProfit,
        maxAskingPrice: values.maxAskingPrice,
        minEmployees: values.minEmployees,
        maxEmployees: values.maxEmployees,
        minYearsInBusiness: values.minYearsInBusiness,
        signalKeywords: parseKeywords(values.signalKeywordsText),
      },
    };
    const result = profile
      ? await updateSearchProfileAction({ id: profile.id, ...data })
      : await createSearchProfileAction({ ...data, active: true });
    if (result?.serverError || result?.validationErrors) {
      notify.error(result.serverError ?? "Couldn't save that search profile. Please try again.");
      throw new Error("search profile action failed");
    }
  };

  return (
    <VaultForm onSubmit={(e) => e.preventDefault()}>
      <VaultField label="Name" required error={errors.name?.message}>
        <VaultInput placeholder="HVAC — Phoenix metro" {...register("name")} />
      </VaultField>

      <VaultField label="Category" required error={errors.category?.message}>
        <VaultInput placeholder="HVAC contractors" {...register("category")} />
      </VaultField>

      <VaultField label="Extra search terms" error={errors.keywordsText?.message}>
        <VaultInput placeholder="air conditioning repair, heating installation" {...register("keywordsText")} />
        <p className="text-xs text-muted-foreground">
          Comma-separated. Each term is searched separately (more terms = more results, and more API cost). Leave empty to search the category only.
        </p>
      </VaultField>

      <div className="grid grid-cols-2 gap-3">
        <VaultField label="City" required error={errors.city?.message}>
          <VaultInput placeholder="Phoenix" {...register("city")} />
        </VaultField>
        <VaultField label="State" required error={errors.state?.message}>
          <VaultInput placeholder="AZ" {...register("state")} />
        </VaultField>
      </div>

      <VaultField label="Radius (miles)" error={errors.radiusMiles?.message}>
        <VaultInput type="number" min={1} max={500} {...register("radiusMiles", { valueAsNumber: true })} />
        <p className="text-xs text-muted-foreground">Google Places caps the search area at about 31 miles.</p>
      </VaultField>

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-sm font-medium text-foreground">Sources</legend>
        {SOURCE_OPTIONS.map((option) => (
          <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-divider bg-surface px-3 py-2.5">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" {...register(`sources.${option.key}`)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-divider p-3">
        <legend className="px-1 text-sm font-medium text-foreground">Qualification criteria (optional)</legend>
        <p className="text-xs text-muted-foreground">
          What a good lead looks like. Each discovered lead is flagged Match, Partial or Miss against this — nothing is ever discarded, and a figure the
          source doesn&rsquo;t state counts as unknown, not a miss. Leave a box blank for no requirement. Amounts are US dollars per year.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <VaultField label="Min revenue" error={errors.minRevenue?.message}>
            <VaultInput type="number" min={0} step={10000} placeholder="e.g. 1000000" {...register("minRevenue", optionalNumber)} />
          </VaultField>
          <VaultField label="Max revenue" error={errors.maxRevenue?.message}>
            <VaultInput type="number" min={0} step={10000} placeholder="e.g. 5000000" {...register("maxRevenue", optionalNumber)} />
          </VaultField>
          <VaultField label="Min profit" error={errors.minProfit?.message}>
            <VaultInput type="number" min={0} step={10000} placeholder="cash flow / SDE" {...register("minProfit", optionalNumber)} />
          </VaultField>
          <VaultField label="Max profit" error={errors.maxProfit?.message}>
            <VaultInput type="number" min={0} step={10000} {...register("maxProfit", optionalNumber)} />
          </VaultField>
          <VaultField label="Max asking price" error={errors.maxAskingPrice?.message}>
            <VaultInput type="number" min={0} step={10000} placeholder="your budget" {...register("maxAskingPrice", optionalNumber)} />
          </VaultField>
          <VaultField label="Min years in business" error={errors.minYearsInBusiness?.message}>
            <VaultInput type="number" min={0} {...register("minYearsInBusiness", optionalNumber)} />
          </VaultField>
          <VaultField label="Min employees" error={errors.minEmployees?.message}>
            <VaultInput type="number" min={0} {...register("minEmployees", optionalNumber)} />
          </VaultField>
          <VaultField label="Max employees" error={errors.maxEmployees?.message}>
            <VaultInput type="number" min={0} {...register("maxEmployees", optionalNumber)} />
          </VaultField>
        </div>
        <VaultField label="Signal keywords" error={errors.signalKeywordsText?.message}>
          <VaultInput placeholder="retiring, owner selling, must sell" {...register("signalKeywordsText")} />
          <p className="text-xs text-muted-foreground">Comma-separated. A lead whose text mentions one is flagged — a bonus, never a requirement.</p>
        </VaultField>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <VaultField label="Max new leads / run" error={errors.maxLeadsPerRun?.message}>
          <VaultInput type="number" min={1} max={200} {...register("maxLeadsPerRun", { valueAsNumber: true })} />
        </VaultField>
        <VaultField label="Run every (hours)" error={errors.frequencyHours?.message}>
          <VaultInput type="number" min={1} max={720} {...register("frequencyHours", { valueAsNumber: true })} />
        </VaultField>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        The cap is the main spend guard: a run stops once it has added this many new leads.
      </p>

      <VaultFooter>
        <VaultSecondaryButton type="button" onClick={onClose}>
          Cancel
        </VaultSecondaryButton>
        <VaultPrimaryButton type="submit" onClick={handleSave}>
          {profile ? "Save changes" : "Create profile"}
        </VaultPrimaryButton>
      </VaultFooter>
    </VaultForm>
  );
}

/** Create (profile = null) or edit a search profile. The form remounts per profile via `key`. */
export function SearchProfileVault({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: SearchProfileSummary | null;
}) {
  return (
    <Vault open={open} onOpenChange={onOpenChange}>
      <VaultContent aria-label={profile ? "Edit search profile" : "New search profile"}>
        <VaultHeader>
          <VaultTitle>{profile ? "Edit search profile" : "New search profile"}</VaultTitle>
          <VaultDescription>What the engine should look for, and where. It applies from the next run.</VaultDescription>
        </VaultHeader>
        {open && <ProfileForm key={profile?.id ?? "new"} profile={profile} onClose={() => onOpenChange(false)} />}
      </VaultContent>
    </Vault>
  );
}
