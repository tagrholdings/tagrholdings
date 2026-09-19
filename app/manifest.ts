import type { MetadataRoute } from "next";

/**
 * Next requires manifest.ts at the app/ root — unlike icon/apple-icon, it
 * doesn't support nesting inside a route group (confirmed the hard way: a
 * copy placed under app/(hub)/ silently stopped being served at all). The
 * <link rel="manifest"> tag it produces is therefore inherited by every
 * route by default; app/page.tsx (marketing), app/portal/page.tsx and
 * app/auth/sign-in/page.tsx each override it back to `null` in their own
 * `metadata` export — a child's explicit field always wins over what it
 * inherited — so only hub routes actually advertise installability. Those
 * other three aren't "the app": this is a CRM PWA for crm.tagrholdings.com,
 * not something a marketing visitor should be prompted to install.
 *
 * That scoping is also what makes a *relative* `start_url` safe here: with
 * the tag suppressed everywhere else, this manifest is only ever fetched
 * from a page already on the CRM host (or localhost in dev — proxy.ts
 * doesn't split hosts there), so "resolve relative to whichever origin
 * served the manifest" always lands on the right domain without hardcoding it.
 *
 * Icons come from public/pwa-icons/android (see .agents/rules/design.md for
 * why `--ink` is the one constant, theme-independent dark — that's also why
 * it's `background_color`/`theme_color` here: the generated icons already
 * have that exact color baked into their background, so there's no seam
 * between an icon and the splash screen it sits on while the app loads).
 */
export default function manifest(): MetadataRoute.Manifest {
  const androidIcon = (size: number) => ({
    src: `/pwa-icons/android/launchericon-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
  });

  return {
    id: "/",
    name: "TAGR Holdings CRM",
    short_name: "TAGR CRM",
    description: "Your hub for managing leads, projects, activities, and contacts.",
    // The installed app always opens at sign-in — an already-valid session
    // skips straight past it (see app/auth/sign-in/page.tsx's own redirect),
    // so this only actually shows the form to a signed-out visitor.
    start_url: "/auth/sign-in",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Web Share Target: "Share → TAGR CRM" from a browser or another app lands on /share, which pre-fills the Leads
    // Inbox quick-add with the shared link/text. GET keeps it a plain navigation inside the app's scope. Android
    // (Chrome) only, and only once the PWA is installed — iOS Safari doesn't support share targets.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    background_color: "#1b1d1f",
    theme_color: "#1b1d1f",
    icons: [
      ...[48, 72, 96, 144, 192, 512].map((size) => androidIcon(size)),
      // Maskable duplicates — Chrome/Android crop these to a circle/squircle
      // and expect the artwork to already sit inside that safe zone (ours
      // does: the mark is centered with generous margin on a full-bleed
      // background), so the same files double as both purposes.
      { ...androidIcon(192), purpose: "maskable" as const },
      { ...androidIcon(512), purpose: "maskable" as const },
    ],
  };
}
