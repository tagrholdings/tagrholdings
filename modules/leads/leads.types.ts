import { z } from "zod";
import { RAW_LEAD_STATUSES, type ExtractedFields, type LeadSourceType, type RawLeadStatus } from "./leads.schema";
import type { LeadFit } from "@/modules/search-profiles/fit";

export const rawLeadIdSchema = z.object({ id: z.uuid() });

export const promoteRawLeadSchema = z.object({
  id: z.uuid(),
  /** Defaults to the business name; editable in the promote form. */
  title: z.string().trim().min(1, "Title is required.").max(200).optional(),
});

export const rawLeadStatusSchema = z.enum(RAW_LEAD_STATUSES);

/** Limits shared by the ingest API and the quick-add action. */
export const MAX_RAW_TEXT_CHARS = 100_000;
const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL." }).max(2048);

/** POST /api/leads/ingest body. `tenantId` is required and cross-checked against the tenants table — there is no default. */
export const ingestLeadRequestSchema = z.object({
  tenantId: z.uuid(),
  sourceUrl: httpUrl,
  rawText: z.string().trim().min(1, "rawText is required.").max(MAX_RAW_TEXT_CHARS),
  businessName: z.string().trim().min(1).max(300).optional(),
  /** Free text from whoever added it — e.g. "found manually, site blocks scraping". */
  note: z.string().trim().max(2000).optional(),
});
export type IngestLeadRequest = z.infer<typeof ingestLeadRequestSchema>;

/** Leads Inbox quick-add: one box that takes either a link or pasted text. tenantId comes from the session, never from here. */
export const quickAddLeadSchema = z.object({
  input: z.string().trim().min(1, "Paste a link or some text.").max(MAX_RAW_TEXT_CHARS),
});

/** Client-side row shape — mirrors leadsService.listForTenant. */
export interface RawLeadSummary {
  id: string;
  sourceType: LeadSourceType;
  sourceUrl: string | null;
  businessName: string;
  extractedFields: ExtractedFields;
  status: RawLeadStatus;
  searchProfileId: string | null;
  searchProfileName: string | null;
  pipelineItemId: string | null;
  createdAt: Date;
  /** How the lead lines up with its search profile's criteria; null when the profile has none (or there's no profile). */
  fit: LeadFit | null;
}

export interface IngestResult {
  id: string;
  /** true when this lead (same source + URL/text/email id) was already in the inbox — nothing new was created or paid for. */
  duplicate: boolean;
  /** true when the AI step didn't produce a usable result and only the source's own fields were kept. */
  extractionFallback: boolean;
}

export interface QuickAddResult extends IngestResult {
  /** false when a pasted link couldn't be read (blocked, not public, error): the lead holds just the URL. */
  pageFetched: boolean;
}
