import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TAGR Holdings",
  description: "Private holding company landing page built with Next.js and Tailwind CSS.",
  // No explicit `manifest` here — Next auto-detects app/manifest.ts and
  // fills this in (always /manifest.webmanifest for a .ts/.js manifest),
  // overwriting anything set here anyway.
  applicationName: "TAGR CRM",
  icons: {
    // Browser-tab favicons — app/favicon.ico still covers the plain .ico
    // fallback; these give a crisper PNG at common sizes.
    icon: [
      { url: "/pwa-icons/ios/32.png", sizes: "32x32", type: "image/png" },
      { url: "/pwa-icons/android/launchericon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/pwa-icons/android/launchericon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    // iOS ignores manifest.icons entirely — this is what "Add to Home
    // Screen" actually reads. 180×180 is Apple's current recommended size;
    // the rest cover older devices still asking for a smaller one.
    apple: [
      { url: "/pwa-icons/ios/180.png", sizes: "180x180", type: "image/png" },
      { url: "/pwa-icons/ios/167.png", sizes: "167x167", type: "image/png" },
      { url: "/pwa-icons/ios/152.png", sizes: "152x152", type: "image/png" },
      { url: "/pwa-icons/ios/120.png", sizes: "120x120", type: "image/png" },
    ],
  },
  // iOS's own PWA meta tags — `manifest.ts`'s `display: "standalone"` only
  // reaches Android/desktop Chrome; Safari needs these separately.
  appleWebApp: {
    capable: true,
    title: "TAGR CRM",
    statusBarStyle: "black",
  },
  other: {
    // Windows/Edge pinned-tile metadata — browserconfig.xml (public/) holds
    // the actual tile image set; these two just point at it and match its
    // background so a pinned tile doesn't show a mismatched color.
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#1b1d1f",
  },
};

// `viewportFit: "cover"` is what makes `env(safe-area-inset-*)` resolve to a
// real value instead of 0 — BottomNav's bottom offset and Vault's mobile
// sheet padding both rely on it once installed on a device with a
// notch/home-indicator (iPhone) or gesture bar (Android). `themeColor`
// matches Sidebar/BottomNav's `--ink` background (see design.md — it's a
// brand constant, not theme-flipped) so the OS status bar/task-switcher
// chrome blends with the app's own dark nav instead of showing a seam.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1d1f",
};

// Runs before hydration so the correct theme is already on <html> for first
// paint — without this, the page would flash light before use-theme.ts's
// effect runs. Kept inline (not an external script) specifically so it
// blocks rendering instead of loading async.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("tagr-theme");
    var theme = stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${publicSans.variable} ${sourceSerif.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
