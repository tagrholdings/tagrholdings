import type { ExtractedFields } from "@/modules/leads/leads.schema";

/**
 * `extractedFields` is loose JSON written by the external job (see
 * leads.schema.ts) — any key may be missing, null, or (if the model drifts)
 * a number or object. These readers turn "unknown" into a string or null so
 * the UI never renders `[object Object]` or throws.
 */
export function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Scraped URLs are untrusted: only http(s) may become an <a href>. */
export function httpUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function locationLine(fields: ExtractedFields): string | null {
  const city = text(fields.location?.city);
  const state = text(fields.location?.state);
  return [city, state].filter(Boolean).join(", ") || text(fields.location?.address);
}

export function signalList(fields: ExtractedFields): string[] {
  return Array.isArray(fields.signals) ? fields.signals.map(text).filter((s): s is string => s !== null) : [];
}
