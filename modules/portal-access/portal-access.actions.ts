"use server";

import { cookies, headers } from "next/headers";
import { Resend } from "resend";
import { actionClient } from "@/lib/safe-action";
import { UserFacingError } from "@/lib/errors";
import { contactAccessEmail } from "@/lib/email/templates/contact-access";
import { notifyTannerEmail } from "@/lib/email/templates/notify-tanner";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { getClientIp } from "@/utils/request";
import { portalAccessService } from "./portal-access.service";
import { requestPortalAccessSchema, sendPortalMessageSchema } from "./portal-access.schema";
import {
  PORTAL_ACCESS_COOKIE,
  PORTAL_ACCESS_COOKIE_MAX_AGE_SECONDS,
  PORTAL_CONTACT_EMAIL,
} from "./portal-access.constants";

const TANNER_NOTIFICATION_EMAIL =
  process.env.TANNER_NOTIFICATION_EMAIL || "admin@tagrholdings.com";

const IP_LIMIT = 5;
const IP_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_LIMIT = 2;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

// Messages come from an already-verified visitor, so the per-sender cap can be
// a little looser than the access gate's — but it still stops one account from
// flooding the inbox.
const MESSAGE_IP_LIMIT = 5;
const MESSAGE_IP_WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_SENDER_LIMIT = 3;
const MESSAGE_SENDER_WINDOW_MS = 60 * 60 * 1000;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * Public action — this is the pre-auth /portal gate, not a signed-in CRM
 * mutation, so it uses the bare `actionClient` rather than `protectedAction`
 * (there is no session to require yet). Validation and error masking still
 * apply the same way.
 */
export const requestPortalAccessAction = actionClient
  .schema(requestPortalAccessSchema)
  .action(async ({ parsedInput }) => {
    const { name, email } = parsedInput;
    const headerList = await headers();
    const ip = getClientIp(headerList);

    if (await rateLimitService.isLimited(`portal:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      throw new UserFacingError("Too many requests. Please try again later.");
    }
    if (await rateLimitService.isLimited(`portal:email:${email}`, EMAIL_LIMIT, EMAIL_WINDOW_MS)) {
      throw new UserFacingError("Too many requests. Please try again later.");
    }

    const token = await portalAccessService.grantAccess(email, name);

    // Set before the email send so the redirect isn't blocked on Resend.
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: PORTAL_ACCESS_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });

    if (resend) {
      const portalUrl = `${process.env.SITE_URL || "http://localhost:3000"}/portal?token=${token}`;
      // Fire-and-forget: a slow or failed backup email shouldn't delay the
      // redirect — the cookie already grants access in this browser.
      void Promise.all([
        // Goes to an address nobody has verified yet, so it carries no
        // submitter-supplied text (see app/api/contact/route.ts for the
        // same constraint on the general contact form).
        resend.emails.send({
          from: "TAGR Holdings <contact@tagrholdings.com>",
          to: [email],
          subject: "Your private access to TAGR Holdings",
          html: contactAccessEmail(token),
          text: `Hi there,\n\nThanks for reaching out. Open your private portal: ${portalUrl}\n\nTAGR Holdings`,
        }),
        resend.emails.send({
          from: "TAGR Holdings <contact@tagrholdings.com>",
          to: [TANNER_NOTIFICATION_EMAIL],
          replyTo: email,
          subject: `New portal access request from ${name || email}`,
          html: notifyTannerEmail(name, email, "Requested instant access via the /portal gate.", {
            submittedAt: new Date(),
            ip,
          }),
        }),
      ]).catch((error) => console.error("Portal access notification email failed", error));
    } else {
      console.error("Portal access granted without email: RESEND_API_KEY is not set.");
    }

    return { success: true };
  });

/**
 * A message from inside the portal. The sender is never taken from the
 * client: identity comes from the access cookie (or the emailed-link token),
 * so the visitor's name and email are exactly what they gave the access form.
 * Unlike /api/contact this neither mints a new access token nor emails the
 * visitor — they already have access.
 */
export const sendPortalMessageAction = actionClient
  .schema(sendPortalMessageSchema)
  .action(async ({ parsedInput }) => {
    const cookieToken = (await cookies()).get(PORTAL_ACCESS_COOKIE)?.value;
    const visitor = await portalAccessService.findVisitor(cookieToken || parsedInput.token);
    if (!visitor) {
      throw new UserFacingError("Your access has expired. Please reload the page and try again.");
    }

    const ip = getClientIp(await headers());
    if (await rateLimitService.isLimited(`portal-message:ip:${ip}`, MESSAGE_IP_LIMIT, MESSAGE_IP_WINDOW_MS)) {
      throw new UserFacingError("Too many messages. Please try again later.");
    }
    if (
      await rateLimitService.isLimited(
        `portal-message:sender:${visitor.email}`,
        MESSAGE_SENDER_LIMIT,
        MESSAGE_SENDER_WINDOW_MS
      )
    ) {
      throw new UserFacingError("Too many messages. Please try again later.");
    }

    const fallback = `We could not send your message right now. Please email ${PORTAL_CONTACT_EMAIL} instead.`;
    if (!resend) {
      console.error("Portal message not sent: RESEND_API_KEY is not set.");
      throw new UserFacingError(fallback);
    }

    // Awaited, unlike the access emails: this message is the whole point of
    // the request, so a failed send has to be reported to the visitor.
    const { error } = await resend.emails.send({
      from: "TAGR Holdings <contact@tagrholdings.com>",
      to: [TANNER_NOTIFICATION_EMAIL],
      replyTo: visitor.email,
      subject: `New portal message from ${visitor.name || visitor.email}`,
      html: notifyTannerEmail(visitor.name ?? undefined, visitor.email, parsedInput.message, {
        submittedAt: new Date(),
        ip,
        title: "New message from the portal",
      }),
    });
    if (error) {
      console.error("Portal message email failed", error);
      throw new UserFacingError(fallback);
    }

    return { success: true };
  });
