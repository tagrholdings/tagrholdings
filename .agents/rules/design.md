# Design — The Tagr Holdings Design System

This project follows the real TAGR Holdings brand tokens, extended with a few CRM-specific tokens built from the same palette. Don't invent colors, fonts, or radii outside this list — the goal is for the CRM and the marketing site to read as the same product.

## Palette

- `--background` / `--paper` (`#ede8df`) — page background
- `--paper-2` (`#e2dbcb`) — secondary surface, e.g. hovered rows, muted panels
- `--cream` (`#f5f2ec`) — used as the CRM's `--surface` token for cards/inputs (lighter than the page background)
- `--ink` / `--foreground` (`#1b1d1f`) — text, and the CRM sidebar/bottom-nav background
- `--brass` (`#9c7200`) — primary accent (buttons, active states, badges). Sampled directly from `public/brand/LogoBrand-Monocolor.png` — don't drift from this value, a previous version of this token (`#9c7a3c`) was a duller, off-brand approximation.
- `--brass-light` (`color-mix(in srgb, var(--brass) 70%, white 30%)`, ≈`#ba9c4d`) — hover state for brass, derived so it stays in sync if `--brass` ever changes
- `--slate` (`#3d4a42`) — secondary accent; used where a second status/badge tone is needed beyond brass (e.g. distinguishing "in progress" from a neutral tag), not for primary actions

CRM-only extensions (not new colors — composed from the tokens above via `color-mix`): `--divider` (a translucent tint of ink), `--accent-active` (brass mixed toward ink for the pressed state), `--sidebar-fg-muted`, `--sidebar-hover`/`--sidebar-border` (paper-tinted overlays for hover/dividers on the dark sidebar and bottom nav), `--accent-foreground` (ink — the text/icon color on top of a brass fill, e.g. the active bottom-nav pill).

## Typography

- **Headings**: `font-serif` → Source Serif, weight 600 — matches the site's editorial tone.
- **Body**: `font-sans` (default) → Public Sans.
- **Small uppercase labels/kickers** (section eyebrows like "DEAL FLOW"): `font-mono` → IBM Plex Mono, ~10.5px, letter-spacing 0.12em, uppercase, muted ink. Use the `.label-kicker` utility class.
- Fonts are loaded via `next/font/google` in `app/layout.tsx`, exposed as `--font-public-sans`, `--font-source-serif`, `--font-ibm-plex-mono` — these feed `@theme inline` in `globals.css`, which is what makes `font-sans`/`font-serif`/`font-mono` work as Tailwind utilities.

## Tailwind v4 — no separate config file

This project uses Tailwind v4's CSS-first configuration (`@import "tailwindcss"` + `@theme inline` in `app/globals.css`). There is **no `tailwind.config.ts`** — don't create one for theme customization; add new design tokens as CSS variables in `globals.css` and expose them inside the `@theme inline` block instead. Content scanning is automatic in v4 (no `content: [...]` array to maintain).

## Radius — two different rules, don't mix them up

- **Most surfaces** (cards, inputs, dialogs): `--radius-sm`/`--radius-md` (8px), `--radius-lg` (12px) for larger containers.
- **Buttons are the exception**: fully pill-shaped (`--radius-pill`, `border-radius: 999px`, via the `.btn-primary` class or `rounded-pill` utility). Don't round cards to match buttons, and don't square off buttons to match cards.

## Shadows

Soft, ink-tinted elevation shadows exist (`--shadow-sm/md/lg`, exposed as `shadow-sm/md/lg` Tailwind utilities) — this isn't a flat/no-shadow style. Use them for dialogs/Vaults, elevated cards, and the floating bottom nav on mobile; most ordinary cards rely on a 1px `--divider` border rather than a shadow.

## Page composition — always through AppShell

Every route under the hub renders its content through **`AppShell`** (`components/layout/AppShell.tsx`) — never assemble `Sidebar`/`AppHeader`/`BottomNav` by hand in a page. `page.tsx` stays a Server Component that fetches data via the Service layer and passes it down; `AppShell` itself only renders chrome and never fetches data:

```tsx
// app/(hub)/pipeline/page.tsx
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth-server";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { PipelineBoard } from "./_components/PipelineBoard";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const items = await pipelineService.getBoardItems(user.tenantId);

  return (
    <AppShell
      user={{ name: user.name, initials: user.initials }}
      badges={{ leadsInboxUnread: await pipelineService.getUnreadLeadCount(user.tenantId) }}
      kicker="Deal flow"
      title="Pipeline"
      showSearch
      primaryAction={{ label: "+ New" }}
    >
      <PipelineBoard initialData={items} />
    </AppShell>
  );
}
```

- `title`/`kicker` drive the header (see below) — every route sets these, don't reuse a generic title across routes.
- `badges` is a flat `{ [navItem.badgeKey]: count }` map (currently only `leadsInboxUnread`) computed from real data by the Service layer, not hardcoded.
- `primaryAction.onClick` can't be a function passed from a Server Component — either omit it (the button still renders, just inert) or wrap the actual button in a small Client Component inside `children` if it needs to open a Vault/call an Action. `primaryAction` on `AppShell`/`AppHeader` is meant for simple cases; anything stateful belongs in `_components/`.
- Content inside `AppShell` follows the same card language as the rest of the design system: `bg-surface`, `border border-divider`, `rounded-lg`, generous padding — no ad-hoc backgrounds or shadows on ordinary containers (see Shadows above).
- A brand-new/empty section renders the dashed-border `Empty` component (see Empty states below), never a raw placeholder `<div>`.

## Responsive navigation — sidebar vs. bottom nav

The app has exactly one navigation model, rendered two different ways depending on viewport width — not two separate navigation designs to keep in sync by hand. Both read from **`lib/navigation.ts`**'s `NAV_ITEMS` (Pipeline, Contacts, Activities, Leads Inbox with its unread badge, Automations) — never hardcode a second nav list in either component.

- **`Sidebar`** (`components/layout/Sidebar.tsx`, desktop/tablet ≥768px): floats off the edges rather than sitting flush — `fixed`, inset `1rem` (`top-4 bottom-4 left-4`) from the viewport, ~216px wide, `rounded-lg` (`--radius-lg`, matching the card radius — don't invent a larger one), `shadow-md` (the page background, `--background`, shows through the gap around it, which is what makes the float read). The brand mark (`/brand/LogoBrand-Monocolor.png`) sits next to the "TAGR" wordmark at the top — same lockup as the marketing nav (`components/shared/nav-bar.tsx`), just smaller (`h-6`). `AppShell`'s content column offsets `md:pl-[248px]` to clear the sidebar's right edge (216px + the 16px inset + a matching 16px gap) — if the sidebar's width or inset ever changes, update that offset too, nothing computes it automatically. Hidden below 768px via plain CSS (`hidden md:flex`) — not a JS media-query check — so there's no hydration flash between layouts. Active item's icon+label render in `text-accent` (brass); non-active items hover with `--sidebar-hover`. User identity (initials + name) is pinned above a Settings link at the bottom.
- **`BottomNav`** (`components/layout/BottomNav.tsx`, mobile/PWA <768px): a **floating, translucent pill**, not a bar flush with the screen edge — `rounded-pill`, `bg-sidebar/75` + `backdrop-blur-md`, `shadow-lg` (the shadow exception for the floating bottom nav, see Shadows above), centered with `left-1/2 -translate-x-1/2`, sized to **~87% of the viewport width** (`w-[87%] max-w-xs`), floating `1rem` + `env(safe-area-inset-bottom)` above the bottom edge. Icon-only — no text labels, unlike the sidebar — with 44×44px minimum touch targets.
- **Active-item indicator**: a solid brass (`bg-accent`) circle behind the active icon (icon becomes `text-ink` on top of it), animated with framer-motion's `layoutId` so the pill **slides** from the old icon to the new one on navigation instead of just repainting. Don't rebuild this as a CSS transition — the shared `layoutId` is what makes it track position across sibling icons.
- The bottom nav shows the first 4 items as direct tabs (`BOTTOM_NAV_MAX_PRIMARY` in `lib/navigation.ts`) and collapses the rest (currently just Automations) behind a **"More"** icon button. "More" opens the existing `DropdownMenu` component, which already renders as a Vault bottom sheet on mobile — don't build a second sheet/menu just for this.
- Never shrink touch targets below 44×44px to fit more items; adjust `BOTTOM_NAV_MAX_PRIMARY` instead.

## Motion library — framer-motion, everywhere

`framer-motion` is the one animation library across the app: `lib/animations.ts`'s shared variants, the bottom-nav active pill (`layoutId`), `Toaster`, and the sign-in page's entrance stagger (`app/auth/sign-in/_components/SignInCard.tsx`, logo → wordmark → card → staggered form fields — `SignInForm` takes a `fieldVariants` prop so the parent's stagger reaches into the form). Don't add a second animation dependency; framer-motion's declarative variants/stagger already cover this app's needs, including one-off page entrances like sign-in's.

## Global adaptive header

**`AppHeader`** (`components/layout/AppHeader.tsx`) is one component that always renders both variants and lets Tailwind's `md:` breakpoint pick which one shows (`flex md:hidden` / `hidden md:flex`) — same zero-JS-flicker approach as the sidebar. Don't reintroduce a `useIsMobile()` check here; that would reopen the hydration-flash problem the CSS-only approach avoids.

- **Desktop/tablet variant**: floats to match the `Sidebar` — `sticky top-4`, `rounded-lg`, `border-divider`, `bg-surface`, `shadow-sm`, instead of a flush `border-b` bar. `AppShell`'s content column carries `md:gap-4 md:pr-4` so the header (and every card below it) shares the same 16px gutter the sidebar uses on its side; `main` drops its own top padding at that breakpoint (`md:pt-0`) since the gap already provides it. Slim top bar content: `kicker` (label-kicker eyebrow) + `title`, an optional search input (`showSearch`, only where a list/filter actually needs it), an optional `primaryAction` button, and an account menu (avatar-initials button opening a `DropdownMenu` with Profile/Sign out). The sidebar already carries primary navigation, so the header doesn't duplicate it.
- **Mobile/PWA variant**: `title`, a back button (`backHref`) when drilled into a detail view (e.g. a pipeline item opened from the board), an optional compact `primaryAction`, **and the same account-menu avatar button** — the bottom nav has no room for account access, so the header is the only place left for it on mobile. Don't drop the avatar here even though there's no search; losing it means there's no way to sign out on mobile at all.
- Search is intentionally desktop-only in the header: on mobile it lives in each route's own search/filter bar near the list content (see below), not in the fixed header, because there isn't room for both a title and a usable search field in a 56px mobile header.
- `forceMode="desktop" | "mobile"` exists only to pin a single variant for previews/demos embedded in a fixed-size frame (the real viewport width can't be trusted there) — never pass it from a real route.

## Layout

- **Main content area**: page background (`--background`) shows behind everything — `Sidebar`, the desktop `AppHeader`, and ordinary content cards all sit on top of it as `bg-surface` panels with their own `rounded-lg`/`shadow`, never as one edge-to-edge surface. Generous padding on desktop, tighter edge padding on mobile (16px), a `.label-kicker` section label at the top (e.g. "DEAL FLOW") — this is `AppHeader`'s `kicker`, not a second label repeated in the page body.
- **Pipeline board**: kanban columns ~250px wide, horizontal scroll for overflow, on desktop/tablet. On mobile, **default to List view** instead of Board — a horizontally-scrolling multi-column kanban doesn't work well with touch and a narrow viewport; the existing Board/List segmented control already gives a working fallback, so mobile just changes the default rather than needing new UI. Column header: colored dot + uppercase serif-heading label + count. Cards: `--surface` background, 1px `--divider` border, `--radius-md`, showing title (serif heading, bold), organization name (muted), contact initials in a small square avatar (not circular) + contact name, activity-count indicator when relevant.
- **Search/filter bar**: search input with a leading icon, next to the view toggle and a primary "New" button; on mobile this row wraps or the "New" action moves into the header (see Global adaptive header above).

## Vaults, not generic Dialogs

Every interaction that would normally use a modal/dialog (editing an item, confirming an action, creating a record) uses the **Vault** component (`components/ui/vault`), styled with `--surface` background, `--divider` border, `--radius-lg`, `--shadow-lg` — not a plain shadcn `<Dialog>` or an ad-hoc custom modal.

- **Desktop/tablet**: centered overlay, as a standard dialog.
- **Mobile**: the same Vault component renders as a **bottom sheet** (slides up from the bottom nav, rounded top corners at `--radius-lg`, drag-to-dismiss) instead of a centered box — centered dialogs are harder to reach and dismiss with one thumb on a phone. This is a responsive behavior of the one Vault component, not a separate mobile-only component.

## Kanban / drag-and-drop

- Implemented with **dnd-kit**, inside a Client Component (`_components/`), on desktop/tablet Board view.
- Follows the column/card visual spec above exactly — column width, card padding, avatar style.
- Dropping a card triggers a Server Action (see `structure.md` — Sandwich Pattern) that persists the new stage, using the Optimistic UI pattern below.
- On mobile (List view), stage changes happen through an explicit control (e.g. a stage picker on the item) rather than drag-and-drop.

## Forms

- Always React Hook Form + Zod (never manual `useState` for a form with more than 1-2 fields).
- Inputs use `--surface` background, `--divider` border, `--radius-md`, minimum 44px touch height on mobile.
- Validation errors appear inline on the field; submission errors (Action failure) appear via toast (`notify.error()`), not generic red text at the top of the form.

## Loading states — always skeleton

Every screen or component that fetches data shows a **skeleton** matching the final layout's shape while loading — never a bare spinner and never a blank screen.

- Skeleton blocks use `--paper-2` as the base tone (a subtle shimmer/pulse animation on top is fine) — never a gray unrelated to the palette.
- Skeleton shape mirrors the real content: pipeline board loading shows column-shaped and card-shaped placeholders in the right positions, a contacts table loading shows placeholder rows matching the real row height, not a single generic centered spinner.
- Implement via Next.js `loading.tsx` per route for the initial server-rendered load, and local skeleton state in Client Components for client-triggered refetches (e.g. a filter change re-querying the list).

## Optimistic UI — always, with visible failure recovery

Every mutation (moving a kanban card, marking an activity done, editing a contact, promoting a lead) updates the UI **immediately**, before the Server Action's response comes back — the user never watches a spinner waiting for a simple action to confirm.

- On failure, the UI **reverts** to the prior state and `notify.error()` shows what went wrong — the user is never left looking at a state that silently didn't actually save.
- Implement with React's `useOptimistic` (or equivalent local-state-then-reconcile pattern) inside the Client Component/Hook that calls the Server Action — this stays consistent with the Sandwich Pattern: the Action/Service/Repository chain is unaware that the UI updated optimistically, it just returns success/failure as normal.
- This applies uniformly across the app — not just the kanban board. A checkbox on an activity, a stage change from the mobile picker, an inline edit on a contact field all follow the same pattern.

## Empty states — always designed

Every list/table/board needs a designed empty state (dashed border, muted centered text, e.g. "+ Add", or a short explanatory line for a completely empty section like a brand-new tenant's pipeline) — never a bare "no items found" or, worse, nothing at all. This applies equally to the mobile List view and bottom-sheet Vaults.

## PWA / mobile installability

- `app/manifest.ts` (Next.js's typed manifest route) declares the app name ("Tagr CRM"), short name, `display: "standalone"`, theme/background colors matching `--ink`/`--background`, and icons (including a maskable icon) — this is what makes "Add to Home Screen" produce an app-like standalone window instead of opening a browser tab.
- Viewport meta must include `viewport-fit=cover` so `env(safe-area-inset-*)` resolves correctly on notched/home-indicator devices — required for the bottom nav and bottom-sheet Vaults to sit correctly above the home indicator.
- A basic service worker (offline app-shell caching) is a later enhancement, not required for the MVP — don't add one until there's an actual need for offline access; an installable manifest alone already delivers the "feels like an app" outcome being asked for here.