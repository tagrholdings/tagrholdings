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

## Page composition — `app/(hub)/layout.tsx` + `HubPage`

Two pieces split the old single `AppShell` (removed — a route's chrome used to be re-created by every `page.tsx`, which remounted Sidebar/BottomNav, reset scroll and collapsed state, and made a route's own `loading.tsx` blank out the sidebar along with the content):

- **`app/(hub)/layout.tsx`**: a Server Component that calls `getCurrentUser()` once and renders **`HubChrome`** (`components/layout/HubChrome.tsx`) — Sidebar + BottomNav + the content column's sidebar-offset. This renders once per route-group mount and persists across navigations, since App Router layouts don't remount when only their `children` changes.
- **`HubPage`** (`components/layout/HubPage.tsx`): `AppHeader` + `main`, rendered by each route's own `page.tsx` — title/kicker/primaryAction genuinely differ per route, and a layout can't receive props from the page below it, so this part still has to live per-page. Never reintroduce `Sidebar`/`BottomNav` here.

`page.tsx` stays a Server Component that fetches data via the Service layer and passes it down; `HubPage` itself only renders header chrome + the `main` wrapper, never fetches data:

```tsx
// app/(hub)/pipeline/page.tsx
import { HubPage } from "@/components/layout/HubPage";
import { getCurrentUser } from "@/lib/auth-server";
import { pipelineService } from "@/modules/pipeline/pipeline.service";
import { PipelineBoard } from "./_components/PipelineBoard";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const items = await pipelineService.getBoardItems(user.tenantId);

  return (
    <HubPage
      user={{ name: user.name, initials: user.initials }}
      kicker="Deal flow"
      title="Pipeline"
      showSearch
    >
      <PipelineBoard initialData={items} />
    </HubPage>
  );
}
```

- `getCurrentUser()` is wrapped in React's `cache()` (`lib/auth-server.ts`) specifically so calling it in both `app/(hub)/layout.tsx` and every `page.tsx` costs one session lookup per request, not two — don't work around "the layout already fetched this" by threading the user through some other mechanism; just call `getCurrentUser()` again where you need it.
- `title`/`kicker` drive the header (see below) — every route sets these, don't reuse a generic title across routes.
- `badges` (the `{ [navItem.badgeKey]: count }` map, e.g. `leadsInboxUnread`) is a `HubChrome`/`Sidebar`/`BottomNav` concern now, not a per-page prop — it is computed in `app/(hub)/layout.tsx` (`leadsInboxUnread` = `leadsService.countNew()`, the unreviewed raw leads; a failed count degrades to "no badge" rather than breaking the shell), not in individual pages.
- `primaryAction.onClick` can't be a function passed from a Server Component — either omit it (the button still renders, just inert) or wrap the actual button in a small Client Component inside `children` if it needs to open a Vault/call an Action. In practice, every "+ New" button so far (Contacts, Pipeline, Activities) lives inside its route's own `_components/*View.tsx` as a `Create*Vault` trigger, not via `HubPage`'s `primaryAction` prop — that prop is really only for a plain link-like action with no state.
- Content inside `HubPage` follows the same card language as the rest of the design system: `bg-surface`, `border border-divider`, `rounded-lg`, generous padding — no ad-hoc backgrounds or shadows on ordinary containers (see Shadows above).
- A brand-new/empty section renders the dashed-border `Empty` component (see Empty states below), never a raw placeholder `<div>` — and per the Optimistic UI note above, an `Empty` state built this way still renders its route's `Create*Vault` trigger so an empty list isn't a dead end.
- **`loading.tsx` caveat**: since `AppHeader` is per-page (inside `HubPage`, not the layout), a route's `loading.tsx` replaces it along with `main` — Sidebar/BottomNav stay put (that's the whole point of the layout split above), but the header still briefly disappears. `components/layout/HubHeaderSkeleton.tsx` stands in for it. A `loading.tsx` can't call `getCurrentUser()` (no data fetching in a loading boundary), which is why this can't just render the real `AppHeader`.

## Responsive navigation — sidebar vs. bottom nav

The app has exactly one navigation model, rendered two different ways depending on viewport width — not two separate navigation designs to keep in sync by hand. Both read from **`lib/navigation.ts`**'s `NAV_ITEMS` (Leads Inbox with its unread badge, Projects, Activities, Contacts, Automations, Docs) — never hardcode a second nav list in either component.

- **`Sidebar`** (`components/layout/Sidebar.tsx`, desktop/tablet ≥768px): floats off the edges rather than sitting flush — `fixed`, inset `1rem` (`top-4 bottom-4 left-4`) from the viewport, `rounded-lg` (`--radius-lg`, matching the card radius — don't invent a larger one), `shadow-md` (the page background, `--background`, shows through the gap around it, which is what makes the float read). The brand mark (`/brand/LogoBrand-Monocolor.png`) sits next to the full "TAGR Holdings" wordmark at the top (`text-accent` on "Holdings", same lockup as the marketing nav and the sign-in page) — smaller than either of those (`text-base`, `h-6` mark) since the sidebar column is narrow. Hidden below 768px via plain CSS (`hidden md:flex`) — not a JS media-query check — so there's no hydration flash between layouts. Active item's icon+label render in `text-accent` (brass); non-active items hover with `--sidebar-hover`. User identity (initials + name) is pinned above a Settings link at the bottom.
  - **Wave motif**: the same `AnimatedWaves` component used on the sign-in page's dark panel (`components/shared/animated-waves.tsx`) renders as the first child inside `<aside>`, at `opacity-60` on top of its own already-low per-path opacities — a design touch, not the page's primary content. Every other child of `<aside>` is wrapped in `relative z-10` specifically so it paints above this absolutely-positioned decorative layer (CSS stacking otherwise puts `position: absolute` siblings above static in-flow ones regardless of DOM order) — keep new Sidebar content inside that wrapper, not as a new direct child of `<aside>`.
  - **Collapsible**: `AppShell` owns the `collapsed` boolean (via `hooks/ui/use-sidebar-collapsed.ts`, persisted to `localStorage` — starts expanded on server/first paint since storage isn't available during SSR, then syncs in an effect, same pattern as `useIsMobile`) and passes `collapsed`/`onToggleCollapsed` down; `Sidebar` itself never owns this state, so `AppShell` can also react to it for the content offset (below). Width animates between `SIDEBAR_WIDTH_EXPANDED` (216px) and `SIDEBAR_WIDTH_COLLAPSED` (72px) — both exported from `Sidebar.tsx`, along with `SIDEBAR_INSET`/`SIDEBAR_GAP` (16px each) — via `transition-[width] duration-300`. Collapsed: the wordmark and the user's name unmount (not just hide) — nav items and the toggle center their icon instead, and get a `title` attribute as a plain tooltip; a nav item's unread badge becomes a small brass dot (`size-2`) on the icon's corner instead of the count pill, since there's no room for the number. The logo mark and the toggle button share one header row both states — expanded, they sit at opposite ends (`justify-between`: mark+wordmark on the left, toggle on the right); collapsed, that same row becomes `flex-col-reverse` so the toggle renders *above* the now-centered mark, using DOM order (button after the logo wrapper in JSX) rather than a second copy of either element.
  - **`AppShell`'s content offset is derived from those same exported constants** (`SIDEBAR_WIDTH_{EXPANDED,COLLAPSED} + SIDEBAR_INSET + SIDEBAR_GAP`, currently 248px / 104px), applied as a CSS custom property (`style={{ "--sidebar-content-offset": ... }}` + `md:pl-[var(--sidebar-content-offset)]`) rather than a Tailwind arbitrary class, specifically so it can be a number computed at runtime from `collapsed` instead of a build-time constant. If the sidebar's width or inset ever changes, it flows through automatically — don't hand-copy a pixel value into `AppShell` again.
- **`BottomNav`** (`components/layout/BottomNav.tsx`, mobile/PWA <768px): a **floating pill in the same solid `--sidebar` color as `Sidebar`** — deliberately not translucent (no `/75` opacity, no `backdrop-blur`) so the two navs read as the same surface — `rounded-pill`, `shadow-lg` (the shadow exception for the floating bottom nav, see Shadows above), centered with `left-1/2 -translate-x-1/2`, sized to **~87% of the viewport width** (`w-[87%] max-w-xs`), floating `1rem` + `env(safe-area-inset-bottom)` above the bottom edge. Icon-only — no text labels, unlike the sidebar — with 44×44px minimum touch targets. No collapsed state — there's no room to collapse a bottom pill further.
- **Active-item indicator**: a solid brass (`bg-accent`) circle behind the active icon (icon becomes `text-ink` on top of it), animated with framer-motion's `layoutId` so the pill **slides** from the old icon to the new one on navigation instead of just repainting. Don't rebuild this as a CSS transition — the shared `layoutId` is what makes it track position across sibling icons.
- The bottom nav shows the first 4 items as direct tabs (`BOTTOM_NAV_MAX_PRIMARY` in `lib/navigation.ts`) and collapses the rest (currently Automations and Docs) behind a **"More"** icon button. "More" opens the existing `DropdownMenu` component, which already renders as a Vault bottom sheet on mobile — don't build a second sheet/menu just for this.
- Never shrink touch targets below 44×44px to fit more items; adjust `BOTTOM_NAV_MAX_PRIMARY` instead.

## Dark mode

Toggled via a `data-theme="light"|"dark"` attribute on `<html>`, not a CSS-only `prefers-color-scheme` media query — `hooks/ui/use-theme.ts` persists an explicit choice to `localStorage` (`tagr-theme`) and falls back to the OS preference when nothing's stored. `app/layout.tsx` runs an inline (non-async) `<script>` before hydration that sets `data-theme` from the same storage key/media query, so there's no light-then-dark flash on load — don't remove that script or move the theme decision into a React effect alone.

- **Only semantic/surface tokens flip** in `globals.css` (`--background`, `--foreground`, `--surface`, `--surface-alt`, `--divider`, `--muted(-foreground)`, `--popover(-foreground)`, `--secondary(-foreground)`, `--sidebar-bg/-hover/-border`) under both `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`. Brand constants (`--brass`, `--ink`, `--paper`, `--cream`, `--slate`) never change — they're reused as raw colors in places like the sidebar ("always dark, independent of the page background") and any `text-ink`/`bg-ink` utility, and flipping them would break those rather than just the page background.
- `ThemeToggle` (`components/ui/theme-toggle.tsx`, a Sun/Moon icon button calling `useTheme().toggleTheme`) lives in both `AppHeader` variants, next to the account-menu avatar — not in the sidebar or a settings page yet.
- Don't add a third "system" option in the UI toggle — it's binary (light/dark) once the user has picked one; "system" only exists as the unpicked default.

## Right-side detail panel (`SidePanel`)

For "click a row in a list, see its details without leaving the list" flows (Contacts, lead/project item detail, activity detail) — a distinct pattern from Vault, which is for modals/forms/confirmations, not read-mostly detail views.

- **Pushes the layout, doesn't overlay it.** `components/shared/side-panel.tsx` is a real flex sibling of the main content (`400px` wide, `framer-motion` animates its wrapper's `width` from 0), not a `fixed` panel with a backdrop — opening it shrinks the content column exactly the way collapsing the main `Sidebar` does, giving a three-column feel (nav `Sidebar` left, main content middle, detail panel right) instead of a modal floating on top. No backdrop, no click-outside-to-close — this isn't modal, the main content stays interactive while the panel is open.
- **Desktop/tablet only.** There's no room to "push" content at phone width, so `SidePanel` doesn't attempt a mobile layout at all — the route's own `Vault`/`SidePanel` dual component (`ContactDetailPanel.tsx`, `components/pipeline/PipelineItemDetail.tsx`, `components/shared/activity-detail-panel.tsx`) branches on `useIsMobile()` and renders `Vault` (bottom sheet) below `md`, `SidePanel` at `md`+. Copy this exact pattern for any new detail panel — don't render bare `SidePanel` without the mobile branch.
- **Wiring**: the route's own `_components/*View.tsx` client component owns the "which row is selected" state (`selectedId`) and wraps its main content + the panel in a `flex min-w-0 flex-1 gap-4` row, with `min-w-0` on *both* the row and the main-content child — without it, a flex child with wide content (a horizontally-scrolling kanban board, for instance) won't actually shrink when the panel opens; the panel just gets pushed off-screen instead. The list/table/board itself stays presentational either way.

## Motion library — framer-motion, everywhere

`framer-motion` is the one animation library across the app: `lib/animations.ts`'s shared variants, the bottom-nav active pill (`layoutId`), `Toaster`, and the sign-in page's entrance stagger (`app/auth/sign-in/_components/SignInCard.tsx`, logo → wordmark → card → staggered form fields — `SignInForm` takes a `fieldVariants` prop so the parent's stagger reaches into the form). Don't add a second animation dependency; framer-motion's declarative variants/stagger already cover this app's needs, including one-off page entrances like sign-in's.

## Global adaptive header

**`AppHeader`** (`components/layout/AppHeader.tsx`) is one component that always renders both variants and lets Tailwind's `md:` breakpoint pick which one shows (`flex md:hidden` / `hidden md:flex`) — same zero-JS-flicker approach as the sidebar. Don't reintroduce a `useIsMobile()` check here; that would reopen the hydration-flash problem the CSS-only approach avoids.

- **Desktop/tablet variant**: `sticky top-4`, no fill — no `bg-surface`, no `border`, no `shadow` — it sits directly on the page background rather than reading as its own panel; only `Sidebar` (and ordinary content cards) get the `bg-surface` card treatment. `AppShell`'s content column carries `md:gap-4 md:pr-4` so the header (and every card below it) shares the same 16px gutter the sidebar uses on its side; `main` drops its own top padding at that breakpoint (`md:pt-0`) since the gap already provides it. Slim top bar content: `kicker` (label-kicker eyebrow) + `title`, an optional search input (`showSearch`, only where a list/filter actually needs it), an optional `primaryAction` button, and an account menu (avatar-initials button opening a `DropdownMenu` with Profile/Sign out). The sidebar already carries primary navigation, so the header doesn't duplicate it.
- **Horizontal padding must match `main`'s, on both breakpoints** — desktop header `px-6` pairs with `main`'s `md:px-6`, mobile header `px-4` pairs with `main`'s `px-4` — so the header's `title`/`kicker` and the first content card below share a left edge. If either one's padding changes, change the other to match; there's no shared constant enforcing this, only convention.
- **Mobile/PWA variant**: `title`, a back button (`backHref`) when drilled into a detail view (e.g. a pipeline item opened from the board), an optional compact `primaryAction`, **and the same account-menu avatar button** — the bottom nav has no room for account access, so the header is the only place left for it on mobile. Don't drop the avatar here even though there's no search; losing it means there's no way to sign out on mobile at all.
- Search is intentionally desktop-only in the header: on mobile it lives in each route's own search/filter bar near the list content (see below), not in the fixed header, because there isn't room for both a title and a usable search field in a 56px mobile header.
- `forceMode="desktop" | "mobile"` exists only to pin a single variant for previews/demos embedded in a fixed-size frame (the real viewport width can't be trusted there) — never pass it from a real route.

## Layout

- **Main content area**: page background (`--background`) shows behind everything — `Sidebar` and ordinary content cards sit on top of it as `bg-surface` panels with their own `rounded-lg`/`shadow`; the desktop `AppHeader` is deliberately unstyled and shows the page background through (see above), so it doesn't compete with those panels as a second surface. `main` stacks its children with `space-y-6` — a page with multiple sections (stat tiles, a table, whatever comes next) gets that spacing for free by just rendering siblings, no per-page spacing decisions needed. Generous padding on desktop, tighter edge padding on mobile (16px), a `.label-kicker` section label at the top (e.g. "DEAL FLOW") — this is `AppHeader`'s `kicker`, not a second label repeated in the page body.
- **Pipeline board**: kanban columns ~250px wide, horizontal scroll for overflow, on desktop/tablet. On mobile, **default to List view** instead of Board — a horizontally-scrolling multi-column kanban doesn't work well with touch and a narrow viewport; the existing Board/List segmented control already gives a working fallback, so mobile just changes the default rather than needing new UI. Column header: colored dot + uppercase serif-heading label + count. Cards: `--surface` background, 1px `--divider` border, `--radius-md`, showing title (serif heading, bold), organization name (muted), contact initials in a small square avatar (not circular) + contact name, activity-count indicator when relevant.
- **Search/filter bar**: search input with a leading icon, next to the view toggle and a primary "New" button; on mobile this row wraps or the "New" action moves into the header (see Global adaptive header above).

## Vaults, not generic Dialogs

Every interaction that would normally use a modal/dialog (editing an item, confirming an action, creating a record) uses the **Vault** component (`components/ui/vault`), styled with `--surface` background, `--divider` border, `--radius-lg`, `--shadow-lg` — not a plain shadcn `<Dialog>` or an ad-hoc custom modal.

- **Desktop/tablet**: centered overlay, as a standard dialog.
- **Mobile**: the same Vault component renders as a **bottom sheet** (slides up from the bottom nav, rounded top corners at `--radius-lg`, drag-to-dismiss) instead of a centered box — centered dialogs are harder to reach and dismiss with one thumb on a phone. This is a responsive behavior of the one Vault component, not a separate mobile-only component.

## Lead engine screens: Leads Inbox (`/leads-inbox`)

The lead engine's output has its own review queue, separate from the managed Leads board below:

- **`/leads-inbox`** — the raw leads the external engine discovered (`raw_leads`), for review. Table + status filter (New / Added / Dismissed) + search; row click opens `RawLeadDetailPanel` (`SidePanel` on tablet/desktop, `Vault` on mobile — same `useIsMobile()` switch as Contacts). Actions: **Add to pipeline** (`leadsService.promote` → organization + optional contact + a card on the Leads board, stage `sourced`), **Dismiss** (archive only, never deletes), **Restore**. The table is **paginated client-side** (`utils/pagination.ts` `paginate()` + `components/ui/pagination.tsx`, 10 per page; tab/search/sort changes reset to page 1, the page is clamped when the list shrinks). Spend is **not** shown here — `SpendStrip` lives only on the Engine spend tab.
- **`/leads-inbox/profiles`** — search profiles (list, create/edit in `SearchProfileVault`, pause/resume). Profiles are never deleted (raw leads and runs reference them).
- **`/leads-inbox/spend`** — itemized engine spend in USD (`SpendReportView`, a Server Component): by service, by call type (with AI tokens), last 30 days, by profile, recent runs. Amounts are the job's **estimates at list price** (see `lead-engine.schema.ts`) — the page says so; never present them as invoiced amounts.
- **Quick-add** (top of `/leads-inbox`, `QuickAddLead`): one box for a link or pasted text → `quickAddLeadAction` → `leadsIngestService.quickAdd` (the same service behind `POST /api/leads/ingest`; tenant from the session). Optimistic: a pending row ("Reading and extracting details…") appears at once and is replaced when the action settles; failures use `notify.error()` and put the text back in the box. `/leads-inbox?add=…` pre-fills it (the PWA share target: `app/(hub)/share/` redirects there — it never ingests).
- **Fit**: leads from a profile with qualification criteria carry `fit` (computed server-side in `leadsService.listForTenant` via `modules/search-profiles/fit.ts`) → `FitBadge` column, a "Best fit" sort, and a fit breakdown in the detail panel. Annotation only: never hide or auto-dismiss a "Miss".
- **`/leads-inbox/email-sources`** — the tracking list of listing sites that deliver by email (`EmailSourcesView`/`EmailSourceVault`): status badge derived by `emailSourceState()`, "Attempt subscribe" (queues the Playwright signup), "Mark subscribed". `subscribed` is only set by the inbound webhook's confirmation click or by hand — never by the signup attempt.
- **`/leads-inbox/listing-sites`** — the brokers' websites the engine crawls for *businesses for sale* (`ListingSitesView`/`ListingSiteVault`): status badge (Read / No matching listings / Blocked / Couldn't read), red banner + *Open site* for `needsManualCheck()` sites (blocked/error — the engine never works around a refusal), Ignore / Use again (`active`), Add site. Source `broker_listings` on a profile turns the crawler on.
- **Email sources — hand-off**: `EmailSourceRow.handoffReason` (from `signupHandoffReason()`, server-side so the client never calls `Date.now()`) drives a red banner and an *Open signup page* button for captcha / `needs_person` / failed / stale-confirmation sites. Same rule as the crawler: what the engine can't or mustn't do is shown on screen for a person, not hidden.
- **Run now** on each profile row: `runSearchProfileNowAction` records `run_requested_at` and optionally dispatches the GitHub workflow; the row shows "Queued" until the job clears the flag (a request older than 15 min is presumed lost and can be repeated).
- The screens share `LeadsInboxTabs` (real links, one route each; five now: Inbox, Search profiles, Listing sites, Email sources, Engine spend). Everything under `/leads-inbox/*` lights up the one "Leads Inbox" nav item via `isNavItemActive`'s prefix match.
- Untrusted data rule: `extractedFields` is scraped/AI-written JSON. Read it only through `_components/lead-fields.ts` (`text()`, `httpUrl()`…) — never render a raw value as an `href` or assume a key exists.

## Boards: Leads, Projects, Activities

All kanban data is `pipeline_items` on a **board** (`pipeline_boards`: `tenantId`, `name`, `columns` jsonb `BoardColumn[]` — `{id, label}`, `isSystem`, `archivedAt`). `pipeline_items.stage` is a column `id` scoped to its board via `board_id`. Three pages sit on top of it:

- **`/leads`** (formerly `/leads-inbox`, renamed when the raw-lead review queue took that name) renders the one system board (`isSystem: true`, "Leads"), seeded lazily per tenant by `pipelineService.ensureDefaultBoard()` (called in `leads/page.tsx`). Default columns in `DEFAULT_BOARD_COLUMNS` (`pipeline.constants.ts`). The system board can't be renamed, archived or deleted — `pipelineService.getEditableBoard()` enforces it.
- **`/pipeline`** is the **Projects** page: one tab per non-system board (`ProjectsView.tsx`). "New project" (`CreateProjectVault.tsx`: a name + stage labels via `useFieldArray`; the server slugifies labels into column ids — the client never invents them). "Manage" (`ManageProjectsVault.tsx`) renames, archives/restores (`archivedAt` — archived tabs are hidden behind "Show archived") and deletes (removes the board and its items; linked activities are detached, not deleted). All four board mutations are optimistic via one `useOptimistic` reducer.
- **`/activities`** is where "This Week" lives now — not a Pipeline tab anymore. Board = `WeekBoard.tsx` (Monday–Sunday columns from `getCurrentWeekDays(now, weekOffset)`, drag to reschedule, ‹ › to change week); List = every activity with Open/Overdue/Today/Tomorrow/Next 7 days/Done/All filters.

**Shared components** live in `components/pipeline/` (not a route's `_components/`), because Leads and Projects render the exact same view: `PipelineView` (toolbar + board/list + detail; optimistic add + stage move), `PipelineBoard`, `PipelineCard`, `PipelineListView` (detailed table: title, organization, contact, stage, activities done/total), `PipelineItemDetail`, `PipelineItemActivities`, `CreatePipelineItemVault`, `ActivityProgressBadge` ("4/8"), and `links.ts`'s `pipelineItemHref()` (leads → `/leads?item=`, project items → `/pipeline?board=&item=`).

**Activities everywhere are one table.** An activity added inside a lead's or project item's panel is a normal `activities` row with `pipelineItemId` set — so it also shows on `/activities` and on the contact's panel. Both the inline form and `CreateActivityVault` render `components/shared/activity-form.tsx`'s `ActivityFormFields` (title, type, due date + time, priority, notes, assignee, linked lead/project, person, organization) — never fork a second field list. New activities default their due date to today so they land on this week's board.

**Deep links**: `/leads?item=`, `/leads-inbox?lead=`, `/pipeline?board=&item=`, `/activities?activity=`, `/contacts?contact=` pre-open the matching detail panel (read in each `page.tsx` from `searchParams`, passed down as `initialSelectedId`).

**Stage pickers are pills, not `Select`**, in both `CreatePipelineItemVault` and `PipelineItemDetail` — both can render inside a Vault on mobile, where `Select` would nest a Drawer (see "Relational pickers" below). Same for the activity form's type and priority.

## Kanban / drag-and-drop

- Implemented with **dnd-kit**, inside a Client Component (`_components/`), on desktop/tablet Board view.
- Follows the column/card visual spec above exactly — column width, card padding, avatar style.
- Dropping a card triggers a Server Action (see `structure.md` — Sandwich Pattern) that persists the new stage, using the Optimistic UI pattern below.
- On mobile (List view), stage changes happen through an explicit control (e.g. a stage picker on the item) rather than drag-and-drop.

## Forms

- Always React Hook Form + Zod (never manual `useState` for a form with more than 1-2 fields).
- Inputs use `--surface` background, `--divider` border, `--radius-md`, minimum 44px touch height on mobile.
- Validation errors appear inline on the field; submission errors (Action failure) appear via toast (`notify.error()`), not generic red text at the top of the form.
- A leading icon inside an input (e.g. the mail/lock icons on sign-in) is an absolutely-positioned icon (`absolute left-3 top-1/2 -translate-y-1/2`, `pointer-events-none`, `text-muted-foreground`) plus `pl-9` on the `Input` itself, wrapped in a `relative` container — not a built-in `Input` prop. A trailing action (the password show/hide toggle) is the same pattern mirrored to `right-3`, plus `pr-9`, as an actual `<button type="button">` so it doesn't submit the form.

## Sign-in page (`app/auth/sign-in/`)

The one page in the app that isn't part of the hub shell or the marketing site — its own layout, not `AppShell`. No public sign-up (see `AGENTS.md`'s tenancy note) — this is the only entry point, so no "Sign up" link, no OAuth buttons, no role picker; just email + password. Went through a couple of visual directions before landing here (a full-bleed hero was tried first) — check git history for `app/auth/sign-in/` before assuming the current layout is the only one that's been considered.

- **Split card, not a full-bleed hero**: `bg-slate` fills the viewport behind it (the app's secondary-accent token, not a new color — see Palette), and a single `rounded-lg bg-surface shadow-lg` card (`max-w-4xl`, `md:grid-cols-2`) sits centered on top. Left column is the form panel; right column is an illustration panel, `hidden` below `md` (the card becomes a single form column on mobile — there's no good way to show a decorative side panel at phone width, so it just doesn't try).
- **Left panel**: small logo lockup (mark `h-7` + "TAGR Holdings", sized like the sidebar's, *not* the oversized `h-16` version an earlier iteration used — this layout doesn't need a hero-sized mark since the panel itself is compact), "Sign in" heading, one line of subtext, then the form (see Forms above for the icon-in-input and password-toggle patterns — unchanged from before).
- **Right panel**: `/background/login-1.png` via `next/image fill object-cover`, plus a testimonial card (`absolute top-6 right-6 left-6`, `bg-surface/95 backdrop-blur-sm`, `border-divider`, `shadow-md`) overlaid near the top. The quote is a real excerpt from Tanner's own words on the landing page (`landing-page.tsx`'s `AnimatedQuote` `text` prop — currently a full paragraph; the sign-in card shows a shorter pull-quote from within it, not new copy), attributed with `/brand/TannerMilne.png` as a small circular avatar + "Tanner, Founder" in the same mono/tracked-caps style `AnimatedQuote`'s own author line uses. Don't invent a different quote or a fake reviewer here — if the excerpt needs to change, pull a different slice of the same real quote.
- Entrance animation and form mechanics: see the Motion library note above and Forms above — nothing else page-specific there.

## Dates — always build with `utils/date.ts`, never bare `new Date(inputValue)`

`new Date("2026-09-18")` (a plain date-only string, e.g. straight from `<input type="date">`) parses as **UTC midnight** — in any US timezone that's still the previous day once formatted back in local time. This bit us for real (an activity's due date saved a day earlier than picked). `utils/date.ts` has the fix baked in:

- **Parsing a date/time input**: `parseLocalDateTime(dateValue, timeValue?)` — builds the `Date` with the `new Date(year, month, day, …)` constructor (always local-timezone), never `new Date(isoString)`. `CreateActivityVault` combines its separate date + optional time inputs this way.
- **Pre-filling an input from a stored `Date`**: `toDateInputValue()` / `toTimeInputValue()` — the inverse, also local-timezone-safe.
- **Displaying a date**: `formatDateUS()` / `formatDateTimeUS()` — always pass `"en-US"` explicitly rather than `toLocaleDateString(undefined, …)`, since `undefined` follows the server/runtime's locale, not the (US-based) user's.

Any new date-input field follows this pattern — don't reach for a bare `new Date()` call on a date-only string.

## Optimistic UI implementation — `next-safe-action`'s `useOptimisticAction`

Don't hand-roll `useOptimistic` + `useTransition` for a Server Action mutation — `next-safe-action/hooks`' `useOptimisticAction(action, { currentState, updateFn, onError })` already wraps that pattern and is what Pipeline (stage moves, drag or the Select) and Activities (the done checkbox) both use. `currentState` is the server-fetched list from `page.tsx`; `updateFn` folds an optimistic input into it; `onError` routes failures to `notify.error()` (never inline error state, per AGENTS.md rule 9) and the hook itself snaps the optimistic value back once the action settles without success — no manual revert logic needed. The action's own `revalidatePath` call is what brings the *real* server state back in sync on success; don't add a manual `router.refresh()` alongside it.

**Exception — more than one mutation kind against the same list**: `useOptimisticAction` binds one optimistic layer to exactly one action, so it doesn't compose when a screen needs two different mutations to both feel instant against the same data (the Activities board: adding, the done checkbox *and* dragging a card to another day all touch the same `activities` list; same for a board's items: add + stage move). There, fall back to React's own `useOptimistic(initialState, reducer)` with a tagged-union patch type (`{ kind: "done", ... } | { kind: "date", ... }`), call each Server Action directly inside `startTransition`, and route `result?.serverError` to `notify.error()` by hand — see `app/(hub)/activities/_components/ActivitiesView.tsx` and `components/pipeline/PipelineView.tsx`. For a create Vault, the parent's handler returns a Promise that resolves/rejects with the action, so `VaultPrimaryButton`'s success/error overlay follows the real result while the optimistic row is already on screen. Still never inline error state; the `onError`-callback convenience is just next-safe-action's, not the pattern's.

## Relational pickers — `CommandSelect`, not `Select`, once nested in a Vault

`Select` (`components/ui/select.tsx`) renders as its own `Vault` (a vaul `Drawer`) on mobile — fine standalone, but nesting a `Drawer` inside another `Drawer` breaks (the outer Vault's focus trap / `aria-hidden` fights the inner one). Every "New activity"/"New pipeline item" Vault has multiple relational pickers (assigned to, linked deal, linked person, linked organization, contact) sitting inside its own outer Vault, so all of those use `components/shared/command-select.tsx`'s `CommandSelect` instead — a search-filterable list rendered **inline** (a plain conditionally-rendered `<div>`, never a portal/Dialog/Drawer of its own), which sidesteps the nested-modal problem entirely and needs no separate mobile/desktop branch, unlike `Select`. Supports a flat `options` list or grouped `groups` (e.g. "Team" / "Contacts" for Activities' assigned-to). `Select` is still the right choice for a small fixed enum with no search need and no nesting risk (Priority: Low/Medium/High; a board's Stage) — the line is "many/dynamic options nested inside a Vault" → `CommandSelect`, "few fixed options" → `Select`.

## Loading states — always skeleton

Every screen or component that fetches data shows a **skeleton** matching the final layout's shape while loading — never a bare spinner and never a blank screen.

- Skeleton blocks (`components/ui/skeleton.tsx`) use `bg-muted` as the base tone — **not** the raw `bg-paper-2` brand token. `--muted` already flips for dark mode (and equals `--paper-2` in light mode, so this looks identical there); `--paper-2` itself is a fixed brand constant and stayed light-tan colored even on a dark background, which was a real bug (skeletons looked wrong in dark mode) before this was caught.
- **Every route's `loading.tsx` renders through `components/layout/HubLoading.tsx`**, not a bare `<div>` — `HubLoading` wraps `HubHeaderSkeleton` (a pixel-matched stand-in for `AppHeader`'s mobile/desktop dual layout, sticky positioning included, so nothing shifts when the real header mounts) around a `flex-1 flex-col` body slot for the route's own content-shaped skeleton. Both `HubLoading`'s root and that body slot need `flex-1` — without it a loading screen just hugs its own content height instead of filling the page (a real bug: skeletons were rendering at roughly 1/3 viewport height before this existed). A route's `loading.tsx` only needs to supply the body content:
  ```tsx
  // app/(hub)/contacts/loading.tsx
  import { Skeleton } from "@/components/ui/skeleton";
  import { HubLoading } from "@/components/layout/HubLoading";

  export default function ContactsLoading() {
    return (
      <HubLoading>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </HubLoading>
    );
  }
  ```
- Skeleton shape mirrors the real content: pipeline board loading shows column-shaped and card-shaped placeholders in the right positions, a contacts table loading shows placeholder rows matching the real row height, not a single generic centered spinner.
- Implement via Next.js `loading.tsx` per route for the initial server-rendered load, and local skeleton state in Client Components for client-triggered refetches (e.g. a filter change re-querying the list).

## Search input

`components/ui/search-input.tsx`'s `SearchInput` is the standard filter-by-text field — leading `Search` icon + `Input`, per the existing "leading icon inside an input" pattern (design.md's Forms section). Used by Contacts (filter by name/email/organization) and each Pipeline board (filter by title/organization) and This Week (filter by subject/contact) — all client-side filtering of the already-loaded list, no server round trip, since these lists are small at this stage. `containerClassName` sizes the wrapper (`min-w-0 flex-1 max-w-xs` is the usual choice next to a view toggle). Don't hand-roll the icon+padding again elsewhere — use this.

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