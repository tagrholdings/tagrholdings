import { UserFacingError } from "@/lib/errors";
import { dispatchLeadEngineWorkflow, type DispatchOutcome } from "@/lib/github-dispatch";
import { emailSourcesRepository } from "./email-sources.repository";
import type { NewEmailSource } from "./email-sources.types";

/** A unique-violation on (tenant, signup_url) means the same site is already listed. */
function isDuplicateUrl(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export const emailSourcesService = {
  async listForTenant(tenantId: string) {
    return emailSourcesRepository.findAllForTenant(tenantId);
  },

  async create(tenantId: string, data: NewEmailSource) {
    try {
      return await emailSourcesRepository.create(tenantId, data);
    } catch (error) {
      if (isDuplicateUrl(error)) throw new UserFacingError("That signup page is already on the list.");
      throw error;
    }
  },

  async update(tenantId: string, id: string, data: Partial<NewEmailSource>) {
    let updated;
    try {
      updated = await emailSourcesRepository.update(tenantId, id, data);
    } catch (error) {
      if (isDuplicateUrl(error)) throw new UserFacingError("That signup page is already on the list.");
      throw error;
    }
    if (!updated) throw new UserFacingError("Email source not found.");
    return updated;
  },

  async remove(tenantId: string, id: string) {
    const existing = await emailSourcesRepository.findById(tenantId, id);
    if (!existing) throw new UserFacingError("Email source not found.");
    await emailSourcesRepository.delete(tenantId, id);
  },

  /** By-hand toggle: the person signed up themselves (e.g. a captcha site), or wants to undo a mistaken "subscribed". */
  async setSubscribed(tenantId: string, id: string, subscribed: boolean) {
    const updated = await emailSourcesRepository.update(tenantId, id, {
      subscribed,
      subscribedAt: subscribed ? new Date() : null,
    });
    if (!updated) throw new UserFacingError("Email source not found.");
    return updated;
  },

  /**
   * "Attempt subscribe": queues the automatic signup in the database and, if GitHub is configured, asks
   * Actions to start the workflow right away. The job (scraper/) does the actual form fill with Playwright.
   */
  async requestAttempt(tenantId: string, id: string): Promise<{ source: Awaited<ReturnType<typeof emailSourcesRepository.update>>; dispatch: DispatchOutcome }> {
    const source = await emailSourcesRepository.findById(tenantId, id);
    if (!source) throw new UserFacingError("Email source not found.");
    if (source.subscribed) throw new UserFacingError("Already subscribed.");
    if (source.captchaProtected || source.lastAttemptResult === "captcha") {
      throw new UserFacingError("This site uses a captcha — sign up by hand, then mark it as subscribed.");
    }
    if (!source.emailFieldSelector || !source.submitSelector) {
      throw new UserFacingError("Add the email field and submit button selectors first — the signup can't be automated without them.");
    }
    const updated = await emailSourcesRepository.update(tenantId, id, { attemptRequestedAt: new Date() });
    const dispatch = await dispatchLeadEngineWorkflow({ task: "email-signups" });
    return { source: updated, dispatch };
  },

  /** Sources still waiting for a subscription: what an incoming confirmation email is matched against. */
  async listAwaitingConfirmation(tenantId: string) {
    return emailSourcesRepository.findAwaitingConfirmation(tenantId);
  },

  /** Called by the inbound-email webhook once a confirmation link has been clicked. */
  async markSubscribedFromConfirmation(tenantId: string, id: string) {
    return emailSourcesRepository.update(tenantId, id, {
      subscribed: true,
      subscribedAt: new Date(),
      attemptRequestedAt: null,
      lastAttemptError: null,
    });
  },

  /** Leaves a visible trace when a matched confirmation link couldn't be opened (status unchanged). */
  async noteConfirmationProblem(tenantId: string, id: string, message: string) {
    const source = await emailSourcesRepository.findById(tenantId, id);
    if (!source) return;
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await emailSourcesRepository.update(tenantId, id, { lastAttemptError: `${stamp} UTC — ${message}`.slice(0, 500) });
  },
};
