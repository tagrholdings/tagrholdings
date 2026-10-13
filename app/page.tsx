import type { Metadata, Viewport } from "next";
import { LandingPage } from "@/components/landing/landing-page";

// Overrides the root layout's inherited <link rel="manifest"> — see
// app/manifest.ts's comment for why the marketing site doesn't advertise
// the CRM as an installable app.
export const metadata: Metadata = { manifest: null };

// A website, not the app: visitors may zoom (the root layout locks it for the CRM).
export const viewport: Viewport = { maximumScale: 5, userScalable: true };

export default function Home() {
  return <LandingPage />;
}
