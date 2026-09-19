import { extractLinks, htmlToText } from "@/lib/html-text";
import { hostOf, parseHttpUrl } from "@/utils/url";

/**
 * Is this incoming email a "please confirm your subscription" message, and for which signup?
 *
 * Deliberately CONSERVATIVE. The two ways to be wrong are not equal:
 *   - a false negative leaves a subscription unconfirmed — a person notices later and clicks the link;
 *   - a false positive would treat a real listing email as a confirmation and skip it (no lead) — worse.
 * So every gate below must pass, and any doubt means "not a confirmation" (the email then goes through
 * normal extraction; worst case it becomes a low-value lead someone dismisses).
 */

export interface InboundEmail {
  from: string;
  subject: string;
  text: string;
  html: string | null;
}

const CONFIRM_SUBJECT = /\b(confirm|verify|activate|opt[- ]?in)\b/i;
// A listing digest or alert is never a confirmation, even if its subject happens to say "confirm".
const LISTING_SUBJECT = /\b(new listings?|listings?|alerts?|digest|newsletter|deals?|for sale|opportunit(?:y|ies))\b/i;
const CONFIRM_LINK = /confirm|verify|activate|opt-?in|subscribe/i;
const NOT_A_CONFIRM_LINK = /unsubscribe|preferences|manage|privacy|terms|view[- ]in[- ]browser|forward/i;
/** Confirmation emails are a couple of sentences and a button; a digest is long. */
const MAX_CONFIRMATION_TEXT_CHARS = 2500;

const TWO_PART_TLDS = new Set(["co.uk", "org.uk", "com.au", "co.nz", "com.br", "co.jp", "co.za", "com.mx"]);
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com",
]);

/** "mail.example.co.uk" -> "example.co.uk". Naive on purpose (no public-suffix list); good enough to relate a sender to a site. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return TWO_PART_TLDS.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

/** The address in `"Name" <addr@host>` (or a bare address), lowercased; "" when there isn't one. */
export function senderAddress(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : from).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(candidate) ? candidate : "";
}

export function senderDomain(from: string): string {
  const address = senderAddress(from);
  return address ? registrableDomain(address.split("@")[1]) : "";
}

/** The sender's site as a URL for `sourceUrl` — null for free-mail senders (gmail.com says nothing about the listing site). */
export function senderSiteUrl(from: string): string | null {
  const domain = senderDomain(from);
  return domain && !FREE_MAIL_DOMAINS.has(domain) ? `https://${domain}` : null;
}

function linksOf(email: InboundEmail) {
  if (email.html) return extractLinks(email.html);
  return [...email.text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map((m) => ({ href: m[0].replace(/[.,;:!?]+$/, ""), text: "" }));
}

export interface ConfirmationCandidate {
  link: string;
}

/** Step 1: does the email look like a confirmation at all? Returns the one confirmation link, or null. */
export function detectConfirmation(email: InboundEmail): ConfirmationCandidate | null {
  if (!CONFIRM_SUBJECT.test(email.subject) || LISTING_SUBJECT.test(email.subject)) return null;

  const body = email.html ? htmlToText(email.html, 20_000) : email.text;
  if (body.trim().length === 0 || body.length > MAX_CONFIRMATION_TEXT_CHARS) return null;

  const candidates = new Map<string, string>();
  for (const link of linksOf(email)) {
    if (!parseHttpUrl(link.href)) continue;
    const label = `${link.href} ${link.text}`;
    if (NOT_A_CONFIRM_LINK.test(label) || !CONFIRM_LINK.test(label)) continue;
    candidates.set(link.href, link.text);
  }
  // Exactly one candidate: two possible "confirm" links means we can't tell which is the real one.
  if (candidates.size !== 1) return null;
  return { link: [...candidates.keys()][0] };
}

export interface SourceRef {
  id: string;
  signupUrl: string;
}

/**
 * Step 2: which listed signup is this confirmation for? A source matches when its site's registrable domain is the
 * sender's or the confirmation link's. Exactly one match, and the link must itself sit on the sender's or the
 * site's domain (we will GET it — never an arbitrary third-party URL). Anything else -> null (don't guess).
 */
export function matchSource<T extends SourceRef>(sources: T[], email: Pick<InboundEmail, "from">, link: string): T | null {
  const sender = senderDomain(email.from);
  const linkDomain = registrableDomain(hostOf(link));
  if (!linkDomain) return null;

  const matches = sources.filter((source) => {
    const site = registrableDomain(hostOf(source.signupUrl));
    if (!site) return false;
    const related = site === sender || site === linkDomain;
    const linkIsTrusted = linkDomain === site || linkDomain === sender;
    return related && linkIsTrusted;
  });
  return matches.length === 1 ? matches[0] : null;
}
