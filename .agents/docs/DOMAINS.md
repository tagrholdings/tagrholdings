# Domain Split — `www.tagrholdings.com` vs `crm.tagrholdings.com`

The marketing site and the CRM are **one Next.js app, one Vercel deployment**, reachable through two domains. `proxy.ts` at the repo root tells them apart by the `Host` header and routes accordingly. There is no second app, no second deploy, no path prefix in the URL the user sees.

## Why not just use `app/(hub)/...`?

`app/(hub)/[feature]/page.tsx` (the structure `structure.md` documents) is a Next.js **route group** — the `(hub)` segment is purely organizational and never appears in the URL. That's convenient for file layout, but it means Next.js itself has no idea `crm.tagrholdings.com` and `www.tagrholdings.com` should show different things at `/`. Without `proxy.ts`, both domains would serve the exact same route table, because they're the same deployment.

## How `proxy.ts` decides

1. `/api/auth/*` always passes through untouched, on either host — sign-in only happens on the CRM subdomain in practice, but the route doesn't need host-based logic.
2. **On `crm.tagrholdings.com`**: `/` gets silently rewritten (`NextResponse.rewrite`, URL bar unchanged) to `/dashboard`, since `app/page.tsx` at the real `/` is the marketing landing page. Every other path passes through as-is — this is what lets `app/(hub)/pipeline/board/page.tsx` just work at `crm.tagrholdings.com/pipeline/board` with zero extra code.
3. **On a *known* marketing host** (`www.tagrholdings.com` or the bare `tagrholdings.com` apex — an explicit list in `proxy.ts`, not "anything that isn't the CRM host"): any path *not* on the marketing allowlist redirects to the same path on `crm.tagrholdings.com`. This stops someone from reaching CRM screens through the marketing domain.
4. **Any other host** — plain `localhost`/`127.0.0.1` in dev, a Vercel preview URL (`*.vercel.app`), or anything else not in step 2 or 3 — passes through untouched, no rewrite and no redirect. There's no real subdomain split on those origins, so both marketing and hub routes are just reachable directly at the one origin.

## The marketing allowlist, and why it's an allowlist

`MARKETING_PATHS` / `MARKETING_API_PREFIXES` in `proxy.ts` is a short, hand-maintained list (`/`, `/portal`, `/portal/tools`, `/api/contact` today). Everything **not** on that list is treated as a hub route by default.

This is the opposite of enumerating hub routes, and deliberately so: the hub is the fast-growing part of this app (checklist items 4 onward add a new route per screen), while the marketing site is small and rarely changes. An allowlist means new hub routes need zero changes to `proxy.ts` to work correctly on both hosts. The cost: **every new marketing-only route must be added to the allowlist**, or `proxy.ts` will treat it as a hub route and redirect marketing visitors straight to `crm.tagrholdings.com`. There's no build-time check for this — forgetting the update fails silently as a wrong redirect, not a build error.

This allowlist-vs-redirect logic **only applies to the known marketing hosts** (`MARKETING_HOSTS` in `proxy.ts`) — it does not apply by default to every host that isn't the CRM host. An earlier version of this file got that backwards (redirect-by-default for "anything not the CRM host"), which broke `localhost:3000/auth/sign-in` (redirected to production — caught 2026-09-17 when testing sign-in locally) and would have broken every Vercel preview deployment the same way. See point 4 above.

## Trade-offs and gotchas

- **Session cookies don't cross hosts.** A session established on `crm.tagrholdings.com` isn't visible on `www.tagrholdings.com` (browsers scope cookies per host, and Neon Auth's cookie isn't configured with a shared parent domain). This is treated as correct, not a bug — there's no reason for the marketing site to know who's signed into the CRM — but it means there's no "single sign-on" feel between the two if that's ever wanted later.
- **Neon Auth's trusted-domain list must include `crm.tagrholdings.com`.** Sign-in/OAuth callbacks fail with `invalid domain` otherwise. `localhost` is pre-approved for dev; the production domain is not — see the `neon` skill's Gotchas section. Not yet added as of this doc — run `neon neon-auth domain add https://crm.tagrholdings.com --branch production`.
- **`proxy.ts` does not enforce authentication.** It only decides which host serves which paths — it does not redirect unauthenticated visitors to sign-in. That's still each hub page's own job via `getCurrentUser()` (see `lib/auth-server.ts`), which throws/redirects per-request. If a centralized "block the whole hub for anonymous users" behavior is wanted later, that's Neon Auth's own `auth.middleware()` (see the `neon` skill's auth reference), layered into `proxy.ts` — not implemented yet.
- **Local dev has no real subdomain.** `proxy.ts` matches `crm.localhost` so `http://crm.localhost:3000` behaves like the CRM host (including the `/` → `/dashboard` rewrite) during `next dev` — but `crm.localhost` needs to resolve to `127.0.0.1`, which some OS/browser combinations do out of the box and others need a `hosts` file entry for. Plain `localhost:3000` (no subdomain) is simpler for everyday dev: every route, marketing or hub, is just directly reachable there (see point 4 above) — the one difference from production is that `/` shows the marketing page instead of being rewritten to `/dashboard`, so go to `/dashboard` directly to see the hub.
- **External steps this repo can't do for you:** the DNS record for `crm.tagrholdings.com` (already configured), attaching `crm.tagrholdings.com` as a domain on the same Vercel project as `www.tagrholdings.com` (Vercel dashboard → Project → Settings → Domains), and the Neon Auth trusted-domain registration above.
