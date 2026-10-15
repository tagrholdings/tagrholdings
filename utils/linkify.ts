/** A piece of plain text: either text to print as-is, or an http(s) URL to render as a link. */
export type TextPart = { kind: "text"; value: string } | { kind: "link"; href: string };

const URL = /https?:\/\/[^\s<>"()]+/g;
/** Punctuation that ends a sentence rather than the URL ("see https://x.test."). */
const TRAILING = /[.,;:!?'’]+$/;

/** Splits text so the URLs in it can be made clickable. Never produces markup — the caller renders the parts. Pure. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL)) {
    const href = match[0].replace(TRAILING, "");
    const start = match.index;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    parts.push({ kind: "link", href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

/** "elinkdfb.mail.smbdealhunter.xyz" → "smbdealhunter.xyz": the part of a host a person recognises. */
export function shortHost(href: string): string {
  try {
    const labels = new globalThis.URL(href).hostname.replace(/^www\./, "").split(".");
    return labels.length > 2 ? labels.slice(-2).join(".") : labels.join(".");
  } catch {
    return href;
  }
}

/**
 * An email's text (as htmlToText stored it: links kept as `label (url)`) made readable: three or more line breaks
 * collapse to one blank line, and a link wrapped in parentheses loses them — the caller shows it as a short chip
 * instead of a wall of tracking URL. Pure.
 */
export function readableEmailParts(text: string): TextPart[] {
  const parts = splitLinks(text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
  for (let i = 0; i < parts.length; i++) {
    const before = parts[i - 1];
    const after = parts[i + 1];
    if (parts[i].kind === "link" && before?.kind === "text" && after?.kind === "text" && /\(\s*$/.test(before.value) && /^\s*\)/.test(after.value)) {
      before.value = before.value.replace(/\s*\(\s*$/, " ");
      after.value = after.value.replace(/^\s*\)/, "");
    }
  }
  return parts.filter((p) => p.kind === "link" || p.value !== "");
}
