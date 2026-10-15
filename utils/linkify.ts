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
