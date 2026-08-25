import { createAccessToken } from "@/lib/access";
import { contactAccessEmail } from "@/lib/email/templates/contact-access";
import { notifyTannerEmail } from "@/lib/email/templates/notify-tanner";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const TANNER_NOTIFICATION_EMAIL =
  process.env.TANNER_NOTIFICATION_EMAIL || "admin@tagrholdings.com";

const IP_LIMIT = 5;
const IP_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_LIMIT = 2;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { name, email, message } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (isRateLimited(`email:${email}`, EMAIL_LIMIT, EMAIL_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    if (!process.env.RESEND_API_KEY || !resend) {
      return NextResponse.json(
        {
          error:
            "Resend is not configured yet. Add RESEND_API_KEY to your environment to enable email delivery.",
        },
        { status: 500 }
      );
    }

    const accessToken = createAccessToken(email);

    await Promise.all([
      resend.emails.send({
        from: "TAGR Holdings <contact@tagrholdings.com>",
        to: [email],
        subject: "Your private access to TAGR Holdings",
        html: contactAccessEmail(name, accessToken),
        text: `Hi ${name || "there"},\n\nThanks for reaching out. Open your private portal: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/portal?token=${accessToken}\n\nTAGR Holdings`,
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
