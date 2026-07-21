import { createAccessToken } from "@/lib/access";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
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

    await resend.emails.send({
      from: "TAGR Holdings <onboarding@resend.dev>",
      to: [email],
      subject: "Your private access to TAGR Holdings",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1b1d1f;">
          <h2 style="color: #9c7a3c;">Welcome to the TAGR Holdings private portal</h2>
          <p>Hi ${name || "there"},</p>
          <p>Thanks for reaching out. You can now access the private operating playbook using the link below.</p>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/portal?token=${accessToken}" style="color: #9c7a3c;">Open your private portal</a></p>
          <p>Your message was:</p>
          <p style="padding: 12px; background: #f5f2ec; border-radius: 6px;">${message || "No message provided."}</p>
        </div>
      `,
    });

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
