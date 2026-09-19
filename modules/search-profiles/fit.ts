import type { ExtractedFields } from "@/modules/leads/leads.schema";
import { hasCriteria, type QualificationCriteria } from "./search-profiles.schema";

/**
 * How a discovered lead lines up with its search profile's qualification criteria. Pure and
 * deterministic — no AI: it compares the numeric fields the extraction produced with the
 * requirements the owner typed in. It only ANNOTATES; a lead is never dropped for missing a
 * criterion (see qualificationCriteriaSchema).
 *
 *   match   — every requirement that could be checked passed (and nothing failed)
 *   partial — some passed, the rest couldn't be checked (the source didn't state the figure)
 *   miss    — at least one stated figure is outside the requirement
 *   unknown — nothing could be checked
 *
 * Missing data is never a fail: most sources (a Google Maps record, a company homepage) don't state
 * revenue, so absence says nothing. Signal keywords are a bonus: finding one lifts an otherwise
 * uncheckable lead to partial/match, but not finding one never downgrades a lead.
 */

export type FitStatus = "match" | "partial" | "miss" | "unknown";
export type FitCheckResult = "pass" | "fail" | "unknown";

export interface FitCheck {
  label: string;
  result: FitCheckResult;
  detail: string;
}

export interface LeadFit {
  status: FitStatus;
  checks: FitCheck[];
}

/** Sort order for "best fit first". */
export const FIT_RANK: Record<FitStatus | "none", number> = { match: 0, partial: 1, unknown: 2, none: 3, miss: 4 };

export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function range(
  label: string,
  value: number | null | undefined,
  min: number | undefined,
  max: number | undefined,
  format: (n: number) => string
): FitCheck | null {
  if (min === undefined && max === undefined) return null;
  const need = [min !== undefined ? `at least ${format(min)}` : null, max !== undefined ? `at most ${format(max)}` : null]
    .filter(Boolean)
    .join(" and ");
  if (value === null || value === undefined) return { label, result: "unknown", detail: `Not stated (wanted ${need})` };
  const ok = (min === undefined || value >= min) && (max === undefined || value <= max);
  return { label, result: ok ? "pass" : "fail", detail: `${format(value)} (wanted ${need})` };
}

function keywordHits(criteria: QualificationCriteria, fields: ExtractedFields): string[] {
  const wanted = (criteria.signalKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (wanted.length === 0) return [];
  const fromJob = new Set((fields.matchedSignals ?? []).map((s) => s.toLowerCase()));
  // The job scans the full raw text; the extracted signals/summary catch what the model itself noticed.
  const haystack = [...(fields.signals ?? []), fields.summary, fields.reasonForSelling].filter(Boolean).join(" \n").toLowerCase();
  return wanted.filter((k) => fromJob.has(k.toLowerCase()) || haystack.includes(k.toLowerCase()));
}

export function evaluateFit(criteria: QualificationCriteria | null | undefined, fields: ExtractedFields | null | undefined): LeadFit | null {
  if (!hasCriteria(criteria)) return null;
  const f = fields ?? {};

  const core = [
    range("Revenue", f.estimatedRevenueUsd, criteria.minRevenue, criteria.maxRevenue, formatUsdCompact),
    range("Profit", f.annualProfitUsd, criteria.minProfit, criteria.maxProfit, formatUsdCompact),
    range("Asking price", f.askingPriceUsd, undefined, criteria.maxAskingPrice, formatUsdCompact),
    range("Employees", f.employeesCount, criteria.minEmployees, criteria.maxEmployees, (n) => String(n)),
    range("Years in business", f.yearsInBusinessCount, criteria.minYearsInBusiness, undefined, (n) => `${n} yrs`),
  ].filter((c): c is FitCheck => c !== null);

  const wantedSignals = (criteria.signalKeywords ?? []).length > 0;
  const hits = keywordHits(criteria, f);
  const signalCheck: FitCheck | null = wantedSignals
    ? hits.length > 0
      ? { label: "Signals", result: "pass", detail: `Mentions ${hits.map((h) => `“${h}”`).join(", ")}` }
      : { label: "Signals", result: "unknown", detail: "No signal keyword found" }
    : null;

  const checks = signalCheck ? [...core, signalCheck] : core;
  if (checks.length === 0) return null;

  let status: FitStatus;
  if (core.some((c) => c.result === "fail")) {
    status = "miss";
  } else if (core.length > 0) {
    const passes = core.filter((c) => c.result === "pass").length;
    if (passes === core.length) status = "match";
    else if (passes > 0) status = "partial";
    else status = signalCheck?.result === "pass" ? "partial" : "unknown";
  } else {
    status = signalCheck?.result === "pass" ? "match" : "unknown";
  }
  return { status, checks };
}
