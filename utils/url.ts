const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|_hsenc$|_hsmi$|ref$|ref_src$)/i;

/** The http(s) URL if `value` parses as one, else null. */
export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Hostname without a leading "www.", lowercased ("" if not a URL). */
export function hostOf(value: string): string {
  return parseHttpUrl(value)?.hostname.toLowerCase().replace(/^www\./, "") ?? "";
}

/**
 * Stable form of a URL for dedupe: lowercase host, no www, no fragment, no tracking parameters
 * (utm_*, fbclid…), no trailing slash. Real query parameters stay — on a listing site
 * `?id=123` is what tells two listings apart.
 */
export function normalizeUrlForDedupe(value: string): string {
  const url = parseHttpUrl(value);
  if (!url) return value.trim().toLowerCase();
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAM.test(key)).sort(([a], [b]) => a.localeCompare(b));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  return `${url.protocol}//${hostOf(value)}${url.pathname.replace(/\/+$/, "")}${query}`;
}

/** First http(s) URL found anywhere in `text`, without trailing punctuation. */
export function firstUrlIn(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
}

/** True when the whole input is a single http(s) URL (a pasted link, nothing else). */
export function isSingleUrl(text: string): boolean {
  const trimmed = text.trim();
  return !/\s/.test(trimmed) && parseHttpUrl(trimmed) !== null;
}
