/**
 * HTML -> readable text, without a DOM dependency. Used to turn a fetched web page
 * or an inbound email into the plain text the AI extraction reads. Deliberately
 * simple: this text is fed to a model that is told to treat it as data, not
 * rendered anywhere, so "good enough to read" is the bar.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  copy: "©",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const BLOCK_TAGS = "p|div|br|li|ul|ol|tr|table|h[1-6]|section|article|header|footer|blockquote|hr";

export interface HtmlLink {
  href: string;
  text: string;
}

/** Every http(s) link in the HTML with its visible text, in document order. */
export function extractLinks(html: string): HtmlLink[] {
  const links: HtmlLink[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities((match[1] ?? match[2] ?? "").trim());
    if (!/^https?:\/\//i.test(href)) continue;
    const text = decodeEntities(match[3].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    links.push({ href, text });
  }
  return links;
}

/**
 * Plain text of an HTML document. Scripts/styles/head are dropped, block tags become
 * line breaks, and each http(s) link is kept as `text (url)` — in a listing email
 * the link IS the most valuable part (it points at the listing).
 */
export function htmlToText(html: string, maxChars = 50_000): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|head|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (_m, dq: string | undefined, sq: string | undefined, inner: string) => {
      const href = decodeEntities((dq ?? sq ?? "").trim());
      const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!/^https?:\/\//i.test(href)) return ` ${label} `;
      return ` ${label || "link"} (${href}) `;
    })
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}
