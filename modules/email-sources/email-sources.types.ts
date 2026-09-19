import { z } from "zod";
import { insertEmailSourceSchema, type EmailSourceOrigin, type SignupAttemptResult } from "./email-sources.schema";

export const createEmailSourceSchema = insertEmailSourceSchema.pick({
  siteName: true,
  signupUrl: true,
  emailFieldSelector: true,
  submitSelector: true,
  captchaProtected: true,
  notes: true,
});
export type NewEmailSource = z.infer<typeof createEmailSourceSchema>;

export const updateEmailSourceSchema = createEmailSourceSchema.partial().extend({ id: z.uuid() });

export const emailSourceIdSchema = z.object({ id: z.uuid() });
export const setSubscribedSchema = z.object({ id: z.uuid(), subscribed: z.boolean() });

/** Where a source stands — derived, so the UI and the tests agree on one definition. */
export type EmailSourceState =
  | "subscribed" // confirmed (by the inbound webhook or by hand)
  | "awaiting_confirmation" // the form was submitted; waiting for the site's confirmation email
  | "captcha" // the job hit a captcha: subscribe by hand, then mark it subscribed
  | "needs_person" // the engine read the form and it wants something only a person can give (NDA, password, an answer…)
  | "failed" // the last automatic attempt failed
  | "queued" // "Attempt subscribe" clicked, the job hasn't run it yet
  | "ready" // configured with selectors, not attempted yet
  | "manual"; // no selectors configured: only ever a manual signup

/** Client-side row shape — mirrors emailSourcesRepository. */
export interface EmailSourceSummary {
  id: string;
  siteName: string;
  signupUrl: string;
  emailFieldSelector: string | null;
  submitSelector: string | null;
  subscribed: boolean;
  captchaProtected: boolean;
  notes: string | null;
  /** Added by a person, or logged by a search profile run that spotted a signup-only page. */
  source: EmailSourceOrigin;
  subscribedAt: Date | null;
  attemptRequestedAt: Date | null;
  lastAttemptAt: Date | null;
  lastAttemptResult: SignupAttemptResult | null;
  lastAttemptError: string | null;
  createdAt: Date;
}

/** A submitted form with no confirmation email after this long is treated as a signup that didn't take. */
export const STALE_CONFIRMATION_DAYS = 3;

/** A row as the Email sources screen gets it: the stored fields plus the "do this one by hand" verdict. */
export type EmailSourceRow = EmailSourceSummary & { handoffReason: string | null };

/**
 * Why a person has to sign up to this site — null when nothing is needed (subscribed, queued, or still in progress).
 * The engine never works around a captcha, accepts terms or invents an answer; it leaves the site flagged with this.
 */
export function signupHandoffReason(
  source: Pick<EmailSourceSummary, "subscribed" | "captchaProtected" | "attemptRequestedAt" | "lastAttemptResult" | "lastAttemptAt" | "lastAttemptError">,
  now: Date
): string | null {
  if (source.subscribed || source.attemptRequestedAt) return null;
  if (source.captchaProtected || source.lastAttemptResult === "captcha") return "The signup form has a captcha — sign up by hand, then mark it subscribed.";
  if (source.lastAttemptResult === "manual") return source.lastAttemptError ?? "The signup form asks for something only a person can give.";
  if (source.lastAttemptResult === "failed") return source.lastAttemptError ? `The automatic signup failed: ${source.lastAttemptError}` : "The automatic signup failed.";
  if (source.lastAttemptResult === "submitted" && source.lastAttemptAt) {
    const days = Math.floor((now.getTime() - source.lastAttemptAt.getTime()) / 86_400_000);
    if (days >= STALE_CONFIRMATION_DAYS) return `The form was submitted ${days} days ago and no confirmation email has arrived — sign up by hand.`;
  }
  return null;
}

export function emailSourceState(source: Pick<EmailSourceSummary, "subscribed" | "captchaProtected" | "emailFieldSelector" | "submitSelector" | "attemptRequestedAt" | "lastAttemptResult">): EmailSourceState {
  if (source.subscribed) return "subscribed";
  if (source.captchaProtected || source.lastAttemptResult === "captcha") return "captcha";
  if (source.attemptRequestedAt) return "queued";
  if (source.lastAttemptResult === "manual") return "needs_person";
  if (source.lastAttemptResult === "submitted") return "awaiting_confirmation";
  if (source.lastAttemptResult === "failed") return "failed";
  if (source.emailFieldSelector && source.submitSelector) return "ready";
  return "manual";
}
