import type { RunStatus, UsageProvider } from "./lead-engine.schema";

/** One billable call to record (mirrors the scraper's UsageEvent). `costUsd` is the estimate at list price. */
export interface UsageEventInput {
  provider: UsageProvider;
  operation: string;
  model?: string | null;
  requests?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd: number;
  /** The profile run it belongs to; omit for manual leads and inbound email. */
  runId?: string | null;
}

/** Headline numbers for the spend strip on the Leads Inbox and the top of the spend page. */
export interface SpendTotals {
  totalUsd: number;
  monthUsd: number;
  last7DaysUsd: number;
  /** New raw leads the engine has added, ever — the denominator for cost per lead. */
  leadsAdded: number;
  /** null until at least one lead was added. */
  costPerLeadUsd: number | null;
}

/** One line of the "where did the money go" table: provider → operation (→ model for AI). */
export interface SpendLine {
  provider: UsageProvider;
  operation: string;
  model: string | null;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface SpendByProfile {
  searchProfileId: string;
  searchProfileName: string;
  costUsd: number;
  runs: number;
  leadsAdded: number;
}

export interface DailySpend {
  /** YYYY-MM-DD (UTC). Days with no spend are filled with 0 so the chart has no gaps. */
  date: string;
  costUsd: number;
}

export interface RunRow {
  id: string;
  searchProfileName: string | null;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  candidatesSeen: number;
  leadsAdded: number;
  /** New "listings by email signup" sites this run logged into Email sources. */
  emailSourcesDetected: number;
  costUsd: number;
  error: string | null;
}

export interface SpendReport {
  totals: SpendTotals;
  lines: SpendLine[];
  byProfile: SpendByProfile[];
  daily: DailySpend[];
  runs: RunRow[];
}
