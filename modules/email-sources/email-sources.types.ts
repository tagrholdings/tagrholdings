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

export function emailSourceState(source: Pick<EmailSourceSummary, "subscribed" | "captchaProtected" | "emailFieldSelector" | "submitSelector" | "attemptRequestedAt" | "lastAttemptResult">): EmailSourceState {
  if (source.subscribed) return "subscribed";
  if (source.captchaProtected || source.lastAttemptResult === "captcha") return "captcha";
  if (source.attemptRequestedAt) return "queued";
  if (source.lastAttemptResult === "submitted") return "awaiting_confirmation";
  if (source.lastAttemptResult === "failed") return "failed";
  if (source.emailFieldSelector && source.submitSelector) return "ready";
  return "manual";
}
