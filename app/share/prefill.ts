import { firstUrlIn, isSingleUrl } from "@/utils/url";

export type ShareParams = { title?: string; text?: string; url?: string };

/**
 * What to pre-fill into the Leads Inbox quick-add box from a Web Share Target payload (title / text / url).
 *
 * Phones are inconsistent about which field carries the link (Android often puts it in `text`), so all three
 * are considered. Highlighted text beats fetching the page (the site may block bots), so when there is real
 * text it's kept together with the link; a lone link stays a lone link so the quick-add fetches and reads it.
 */
export function prefillFromShare({ title, text, url }: ShareParams): string {
  const sharedText = (text ?? "").trim();
  const sharedUrl = (url ?? "").trim() || (isSingleUrl(sharedText) ? sharedText : (firstUrlIn(sharedText) ?? ""));
  const body = isSingleUrl(sharedText) ? "" : sharedText;

  if (body) return sharedUrl && !body.includes(sharedUrl) ? `${body}\n${sharedUrl}` : body;
  if (sharedUrl) return sharedUrl;
  return (title ?? "").trim();
}
