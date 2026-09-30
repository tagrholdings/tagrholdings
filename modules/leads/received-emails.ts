import type { ExtractedFields, RawLeadStatus } from "./leads.schema";

/** One row of `findEmailDigests`. */
export interface EmailDigestRow {
  id: string;
  /** `email:<resend email id>:<n>` (a listing) or `email:<resend email id>` (an email with no listing in it). */
  dedupeKey: string;
  businessName: string;
  sourceUrl: string | null;
  extractedFields: ExtractedFields;
  status: RawLeadStatus;
  createdAt: Date;
  /** The start of rawText: "From: …\nSubject: …". */
  head: string;
}

export interface ReceivedListing {
  leadId: string;
  businessName: string;
  location: string | null;
  askingPrice: string | null;
  revenue: string | null;
  summary: string | null;
  link: string | null;
  status: RawLeadStatus;
}

export interface ReceivedEmail {
  emailId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  listings: ReceivedListing[];
  /**
   * `read`: at least one business for sale was found in it. `nothing`: it was read but no listing was recognised
   * (a welcome mail, a promo). `failed`: the automatic reading failed — someone should open it by hand.
   */
  outcome: "read" | "nothing" | "failed";
  /** The lead saved for a `nothing` / `failed` email, so it can still be opened. */
  fallbackLeadId: string | null;
}

const NOTHING = "No business for sale was recognised";
const LISTING_KEY = /^email:[^:]+:\d+$/;

function header(head: string, name: string): string {
  const match = new RegExp(`^${name}:[ \\t]*(.*)$`, "im").exec(head);
  return match?.[1]?.trim() ?? "";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpLink(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

/** Groups the email-sourced leads back into the emails they came from (newest first). Pure — unit-tested. */
export function groupReceivedEmails(rows: EmailDigestRow[]): ReceivedEmail[] {
  const byEmail = new Map<string, EmailDigestRow[]>();
  for (const row of rows) {
    const emailId = row.dedupeKey.split(":")[1] ?? row.dedupeKey;
    byEmail.set(emailId, [...(byEmail.get(emailId) ?? []), row]);
  }

  const emails: ReceivedEmail[] = [];
  for (const [emailId, group] of byEmail) {
    const first = group[0];
    const isFallback = group.length === 1 && !LISTING_KEY.test(first.dedupeKey);
    const summary = str(first.extractedFields.summary);
    const outcome: ReceivedEmail["outcome"] = !isFallback ? "read" : summary?.startsWith(NOTHING) ? "nothing" : "failed";

    emails.push({
      emailId,
      from: header(first.head, "From") || "Unknown sender",
      subject: header(first.head, "Subject") || "(no subject)",
      receivedAt: group.reduce((earliest, r) => (r.createdAt < earliest ? r.createdAt : earliest), first.createdAt),
      outcome,
      fallbackLeadId: isFallback ? first.id : null,
      listings: isFallback
        ? []
        : [...group]
            .sort((a, b) => Number(a.dedupeKey.split(":")[2]) - Number(b.dedupeKey.split(":")[2]))
            .map((row) => {
              const f = row.extractedFields;
              const location = [str(f.location?.city), str(f.location?.state)].filter(Boolean).join(", ");
              return {
                leadId: row.id,
                businessName: row.businessName,
                location: location || null,
                askingPrice: str(f.askingPrice),
                revenue: str(f.estimatedRevenue),
                summary: str(f.summary),
                link: httpLink(row.sourceUrl),
                status: row.status,
              };
            }),
    });
  }
  return emails.sort((a, b) => +b.receivedAt - +a.receivedAt);
}
