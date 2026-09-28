/**
 * The browser/OS chrome color (`<meta name="theme-color">` — the mobile status bar, the installed app's title
 * bar) for each theme. These are the page background tokens (`--background` in globals.css: `#ede8df` light,
 * `#131417` dark), so the chrome blends with the page in whichever theme is active.
 *
 * Plain module (no "use client"/"server-only") — it's read by the root layout's inline script AND by the theme hook.
 */
export const THEME_COLORS = { light: "#ede8df", dark: "#131417" } as const;

export type ThemeName = keyof typeof THEME_COLORS;

/** Points the page's theme-color meta at the given theme's color. A no-op if the tag isn't there. */
export function applyThemeColor(theme: ThemeName) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}
