import "server-only";
import { Resend } from "resend";

const FROM = "TAGR Holdings <contact@tagrholdings.com>";

let client: Resend | null | undefined;
function resend(): Resend | null {
  if (client === undefined) client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  return client;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative — mail clients that don't render HTML (and spam filters) look at it. */
  text: string;
}

/** Sends one transactional email. Returns false (never throws) when it couldn't go out, so the caller decides what that means. */
export async function sendEmail({ to, subject, html, text }: OutgoingEmail): Promise<boolean> {
  const sender = resend();
  if (!sender) {
    console.error(`Email to ${to} not sent: RESEND_API_KEY is not set.`);
    return false;
  }
  try {
    const { error } = await sender.emails.send({ from: FROM, to: [to], subject, html, text });
    if (error) {
      console.error("Email send failed:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}
