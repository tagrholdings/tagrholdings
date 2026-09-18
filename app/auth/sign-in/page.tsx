import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { SignInCard } from "./_components/SignInCard";

// Overrides the root layout's inherited <link rel="manifest"> — see
// app/manifest.ts's comment. Sign-in is the PWA's start_url once installed,
// but the page itself (reached by a signed-out visitor, outside the
// installed app) still shouldn't separately prompt "install TAGR CRM".
export const metadata: Metadata = { manifest: null };

// auth.getSession() reads request cookies — can't be statically rendered.
export const dynamic = "force-dynamic";

/**
 * The installed PWA's start_url (see app/(hub)/manifest.ts) — every launch
 * opens here first. A signed-out visitor sees the form below; an
 * already-valid session redirects straight into the hub instead of asking
 * to sign in again every time the app is reopened. Doesn't use
 * getCurrentUser() (lib/auth-server.ts) — that helper redirects to this
 * exact page when there's no session, the opposite of what's needed here.
 */
export default async function SignInPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) {
    redirect("/activities");
  }

  return <SignInCard />;
}
