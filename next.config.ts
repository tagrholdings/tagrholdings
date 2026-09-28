import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces: they'd force every page (including the static marketing site)
// into dynamic rendering, so inline scripts are allowed via 'unsafe-inline'.
// The directives that matter most here still apply: nothing loads from a
// third-party origin, and no other site can frame the CRM (clickjacking).
// Dev needs 'unsafe-eval' for React's debugging tooling (see Next's CSP guide).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

// Identifies this deployment. The installed app compares the id it loaded with the one /api/version reports
// from the live server to tell "a newer version is out" (Settings → Application). Vercel supplies the commit
// on every deploy; locally there is no such thing as a newer deployment, so it stays a constant.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) || "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // The push service worker: never cached, so an update reaches every browser on its next visit.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
