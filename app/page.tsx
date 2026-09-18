import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

// Overrides the root layout's inherited <link rel="manifest"> — see
// app/manifest.ts's comment for why the marketing site doesn't advertise
// the CRM as an installable app.
export const metadata: Metadata = { manifest: null };

export default function Home() {
  return <LandingPage />;
}
