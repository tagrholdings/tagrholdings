import { createAccessToken } from "@/lib/access";
import { contactAccessEmail } from "@/lib/email/templates/contact-access";
import { notifyTannerEmail } from "@/lib/email/templates/notify-tanner";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { getClientIp } from "@/utils/request";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const TANNER_NOTIFICATION_EMAIL =
  process.env.TANNER_NOTIFICATION_EMAIL || "admin@tagrholdings.com";

const IP_LIMIT = 5;
const IP_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_LIMIT = 2;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

const contactRequestSchema = z.object({
  // No control characters: `name` ends up in the notification's subject line.
  name: z
    .string()
    .trim()
    .max(100)
    .regex(/^[^\p{Cc}]*$/u)
    .optional(),
  // Lowercased so `A@x.com` and `a@x.com` share one rate-limit bucket.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  message: z.string().trim().max(5000).optional(),
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function tooManyRequests() {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429 }
  );
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await rateLimitService.isLimited(`contact:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      return tooManyRequests();
    }

    const parsed = contactRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }
    const { name, email, message } = parsed.data;

    if (await rateLimitService.isLimited(`contact:email:${email}`, EMAIL_LIMIT, EMAIL_WINDOW_MS)) {
      return tooManyRequests();
    }

    if (!resend) {
      console.error("Contact submission failed: RESEND_API_KEY is not set.");
      return NextResponse.json(
        { error: "We could not complete the submission right now." },
        { status: 500 }
      );
    }

    const accessToken = createAccessToken(email);
    const portalUrl = `${process.env.SITE_URL || "http://localhost:3000"}/portal?token=${accessToken}`;

    await Promise.all([
      // Goes to an address nobody has verified yet, so it carries no
      // submitter-supplied text — otherwise this endpoint could send
      // arbitrary content from contact@tagrholdings.com to anyone.
      resend.emails.send({
        from: "TAGR Holdings <contact@tagrholdings.com>",
        to: [email],
        subject: "Your private access to TAGR Holdings",
        html: contactAccessEmail(accessToken),
        text: `Hi there,\n\nThanks for reaching out. Open your private portal: ${portalUrl}\n\nTAGR Holdings`,
      }),
      resend.emails.send({
        from: "TAGR Holdings <contact@tagrholdings.com>",
        to: [TANNER_NOTIFICATION_EMAIL],
        replyTo: email,
        subject: `New contact form submission from ${name || email}`,
        html: notifyTannerEmail(name, email, message, {
          submittedAt: new Date(),
          ip,
        }),
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Your access has been granted and the email is on its way.",
    });
  } catch (error) {
    console.error("Contact submission failed", error);
    return NextResponse.json(
      { error: "We could not complete the submission right now." },
      { status: 500 }
    );
  }
}
