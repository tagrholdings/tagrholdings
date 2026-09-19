# Lead Ingestion — Contract Between the External Job and the CRM

## Who writes, who reads

Leads reach `raw_leads` through **three doors**, all ending in the same table and the same review queue (the Leads Inbox):

| Door | Writer | `sourceType`s | Extraction runs in |
|---|---|---|---|
| **Scheduled discovery** | the external Python job in `scraper/` (GitHub Actions cron today, a dedicated server later — same Docker image) | `google_places`, `brave_search`, `marketplace_scrape` (shelved) | the job (`scraper/src/leadengine/extraction/`) |
| **Real-time intake** | this app: `POST /api/leads/ingest` (API key), the Leads Inbox quick-add (Server Action), the PWA share target | `manual_assist` | the app (`modules/lead-extraction/`) via `leadsIngestService` |
| **Inbound email** | this app: the Resend `email.received` webhook | `email_digest` | the app, same service |

- **Reads and transforms `raw_leads`**: `modules/leads` (Service/Repository). `modules/lead-engine` reads runs and spend; `modules/search-profiles` owns the profiles the job consumes; `modules/email-sources` + `modules/email-inbound` own the email flow.
- The app and the job still only talk to each other **through Postgres**. The app never calls the scraper. The one addition is a courtesy: "Run now" / "Attempt subscribe" record a request in the database (`run_requested_at` / `attempt_requested_at` — the contract) and, if configured, ALSO ask GitHub Actions to start the workflow immediately (`lib/github-dispatch.ts`). Without GitHub configured the request simply waits for the next scheduled run.
- **One extraction spec, two runtimes.** The AI prompt, the strict JSON output schema and the price table live in `scraper/src/leadengine/shared/lead-engine-spec.json`, read by both the job and the app. The field mapping (model output → `extractedFields`) is implemented on both sides and pinned by one golden fixture, `scraper/tests/fixtures/extraction_golden.json`, asserted by both test suites. Change the prompt/schema/prices in the JSON only.

`scraper/README.md` covers running the job; the in-app explanation for the user is `/docs` → "How the lead engine works".

## Database access for the job — role `lead_scraper`

The job does **not** connect as the app's owner role (`neondb_owner` has `BYPASSRLS`). It uses `lead_scraper` (`drizzle/0006`, grants in `0008`): `LOGIN NOBYPASSRLS`, least-privilege grants, and per-transaction `set_config('app.tenant_id', <the profile's tenant>, true)`. What it may do:

| Table | `lead_scraper` may |
|---|---|
| `search_profiles` | `SELECT` **active profiles of every tenant** (the only cross-tenant access — how it learns what to run); `UPDATE` only `last_run_at`, `run_state`, `run_requested_at` |
| `email_sources` | `SELECT` unsubscribed sources of every tenant (to find signups to attempt) **and every source of its own tenant** (to avoid logging a domain twice); `UPDATE` only `captcha_protected`, `attempt_requested_at`, `last_attempt_*`, `updated_at` — never `subscribed`, the URL or the selectors; `INSERT` only the columns `tenant_id, site_name, signup_url, email_field_selector, submit_selector, notes, source`, and only rows with `source = 'auto_detected'`, not subscribed, not captcha-protected, in its own tenant (auto-detection) |
| `raw_leads` | `SELECT`, `INSERT` — only rows whose `tenant_id` equals the transaction's `app.tenant_id` |
| `lead_runs` | `SELECT`, `INSERT`, `UPDATE` (same tenant rule) |
| `lead_api_usage` | `SELECT`, `INSERT` (same tenant rule) |
| everything else | nothing (no `tenants`, `contacts`, `pipeline_*`, …) |

The migration creates the role **without a password**. After applying it on a branch, run once: `ALTER ROLE lead_scraper PASSWORD '<generated>'`, and store the connection string as `DATABASE_URL_SCRAPER` (GitHub Actions secret / `scraper/.env`). Verified on `development`: cross-tenant insert, insert with no tenant set, editing profile config, reading `tenants`/`contacts` and deleting leads are all rejected.

## Tables

### `raw_leads` (`modules/leads/leads.schema.ts`)

Every candidate, whatever the source. Fields the job populates on insert:

- `tenantId` — from the search profile that originated the run (never inferred by the app).
- `searchProfileId` — that profile.
- `sourceType` — `"google_places"` | `"brave_search"` | `"marketplace_scrape"` | `"company_site_scrape"` | `"email_digest"` (inbound email, written by the Resend webhook) | `"manual_assist"` (a lead added by hand: the ingest API, the Leads Inbox quick-add, the share target).
- `sourceUrl` — link the candidate came from (Maps page, search result, listing).
- `businessName`
- `rawText` — the text the AI saw (source record + website text), capped, kept for audit/reprocessing. The app never selects it.
- `extractedFields` — jsonb, see below.
- `dedupeKey` — stable identity within a source: Places place id, website host (Brave Search), `bizbuysell:<listing id>`. **Unique with `(tenantId, sourceType)`** → inserts are idempotent (`ON CONFLICT DO NOTHING`), and the job checks the key *before* enrichment/AI so known leads cost nothing.
- `status` — `"new"` (default) | `"processed"` | `"dismissed"` — flipped only by the app.
- `pipelineItemId` — set by the app on promotion (composite FK, audit trail).

Rows are **never deleted**.

### `extractedFields` (flexible JSON — readers must tolerate missing/null keys)

```
businessName, industry, summary,
location { address, city, state }, website,
contact { name, email, phone },
estimatedRevenue, askingPrice, reasonForSelling,
employees, yearsInBusiness, signals[]
```

Values are strings as the source wrote them ("$1.2M", "12 employees") — the extractor is told not to convert or guess. The TypeScript shape is `ExtractedFields` in `leads.schema.ts`; the job's mapping is `scraper/src/leadengine/extraction/extractor.py` (`to_extracted_fields`). Treat it as **untrusted input** (scraped and model-written): render through `app/(hub)/leads-inbox/_components/lead-fields.ts`, validate any URL before it becomes an `href`.

### `search_profiles` (`modules/search-profiles/search-profiles.schema.ts`)

`name`, `category`, `keywords[]`, `city`, `state`, `radiusMiles`, `sources` (`google_places`, `brave_search`, `company_site_scrape`, `marketplace_scrape` → bool), `maxLeadsPerRun` (spend guard), `frequencyHours`, `active`. Job-owned: `lastRunAt`, `runState` (checkpoint: `cursor {source, term}`, `resume`, cached `geocode`) — the app never reads or writes them. `criteria` (jsonb, optional — see *Qualification criteria and fit* below) and `runRequestedAt` ("Run now", app-set / job-cleared).

### `lead_runs` / `lead_api_usage` (`modules/lead-engine/lead-engine.schema.ts`)

One `lead_runs` row per execution of one profile (`running|completed|partial|failed`, candidates seen, leads added, error). One `lead_api_usage` row per billable call: `provider` (`openai`, `google_places`, `brave_search`, `google_geocoding`), `operation`, `model`, `requests`, `inputTokens`/`outputTokens`, `costUsd`. **`costUsd` is the job's estimate at list price** (`scraper/src/leadengine/pricing.py`), recorded when the call happens; free tiers/credits are not subtracted. Only calls the provider actually accepted are recorded (a rejected Geocoding request, or a Brave 429, is not spend). Brave Search is priced at US$ 0.005 per request (Search plan: US$ 5 / 1,000, plus US$ 5 of free credit per month that is not subtracted).

## Discovery sources (what each one does)

- **`google_places`** — Places API (New) text search by category + area; structured (name, address, phone, website).
- **`brave_search`** — Brave Search API, Web Search endpoint (`GET https://api.search.brave.com/res/v1/web/search`, header `X-Subscription-Token`; `count` ≤ 20, `offset` is a *page* index ≤ 9). Finds company websites by keyword (`"<term> <city> <state>"`, up to 3 pages per term). Replaced the Google Custom Search source (Google closed open-web search for new engines — see migration `0009`, which renamed the stored source id `google_custom_search` → `brave_search`). Directories/social sites and "15 best … in Phoenix" roundup pages are skipped before any enrichment or AI spend. Needs only `BRAVE_API_KEY` — no search-engine id to configure.
- **`marketplace_scrape`** — BizBuySell adapter (Playwright). **Shelved:** the site blocks bots and no bypass is pursued; the adapter stays in the code, off by default, and stops at the first block.
- **`broker_listings`** — *businesses for sale*, read straight from the business brokers' own websites; see *Broker listing sites* below. The profile's category + terms are the **industries** to buy (HVAC, plumbing, pest control, property management…), not a business type to find in an area.
- **`company_site_scrape`** — enrichment only, not a discovery source.
- **`email_digest`** — listings that arrive by email; see *Inbound email* below. **Subscribing** a site to the inbox is a separate step (tracked in `email_sources`; automatable only where the form has no captcha).
- **`manual_assist`** — a lead someone added by hand; see *Real-time intake* below.

## Broker listing sites (`broker_listings`, table `listing_sites`)

Two sources of *for-sale* leads exist side by side: the **listing emails** the inbox receives (*Inbound email*) and this crawler. It automates what a person does by hand: search for business brokers in the state, open each one's "buy a business / available listings" page, look at the wanted industries.

`listing_sites` (`modules/listing-sites/`, tenant-scoped, one row per registrable domain) is the persistent list: `siteName`, `domain`, `siteUrl`, `listingsUrl` (learned), `source` (`manual` | `auto_detected`), `active` (false = *Ignored*: neither crawled nor re-discovered), `status` (`pending` | `ok` | `no_listings` | `blocked` | `error`), `statusDetail`, `lastCrawledAt`, `lastListingCount`, `contentHashes` (job bookkeeping, never sent to the client). UI: Leads Inbox → *Listing sites* (add by hand, Ignore / Use again, a banner for sites the engine could not read).

Per run of a profile with `broker_listings` on (`scraper/src/leadengine/sources/broker_listings.py`; one plan step `(broker_listings, "*")`, so each broker is opened once whatever the number of industries):

1. **Discovery** — at most once every 7 days per profile (`runState.broker_discovery_at`), Brave queries `business brokers <state>`, `business broker <city> <state>` and `<industry> business for sale broker <state>` (≤ 4 industries) add up to 20 *new* sites (`source = auto_detected`). A domain already on the list — including an ignored one — is never re-added; aggregators (BizBuySell…) and "10 best brokers" roundups are skipped. No `BRAVE_API_KEY` → discovery is skipped and known sites are still crawled.
2. **Crawl** each active site — polite: robots.txt, per-domain throttle, honest user agent, size cap, public-URL (SSRF) check, ≤ 14 fetches per site. From the homepage it finds the listings page(s) (links like *buy a business / businesses for sale / listings*, never *sell / contact / about / sold…*), follows **category links named after the profile's industries**, the site's own **GET keyword search** (once per site, a read-only URL a browser would build; never a POST/login/newsletter form), and **next-page** links (a "Next" link, else the numbered page right after the current one). A page whose text hash is unchanged since the last run costs no AI call (`content_hashes`, keyed `<profileId>|<url>`).
3. **Extraction** — the AI reads each page with the shared `listingsExtraction` spec (up to 25 listings, "sold / under contract" skipped in the prompt). Listings on a page reached through an industry-named category link are all kept (the site already filtered them); everywhere else a listing is kept only if its name/industry/summary matches the profile's industries (`INDUSTRY_SYNONYMS` — e.g. HVAC also matches *heating / air conditioning / refrigeration*). A listing whose title or link says *sold / under contract* is dropped.
4. Each kept listing is **one lead** (`sourceType = broker_listings`) with the fields already extracted (the runner saves them as-is — no second AI call), `sourceUrl` = the listing's own link with tracking/session tokens (`utm_*`, `swpmtx*`, nonces…) removed but listing-identifying query parameters kept, `dedupeKey` = `url:<normalized link>` (or `sig:<hash>` when the listing has no link; the same `listingSignature` an emailed copy gets, so a listing seen by email *and* on the site collapses to one).

**Blocked is a result, not an obstacle.** robots.txt disallow, HTTP 401/403/429 → `status = blocked` (retry window 14 days, `error` 1 day, `no_listings` 14 days); nothing is worked around. The site is shown in red on *Listing sites* ("check by hand") — and if it offers listing emails, add it under *Email sources*.

The crawl outcome is written **after** the runner has consumed the site's candidates, so a run stopped mid-way (lead cap, time limit) reads the site again next time instead of marking unseen listings as done. Job database limits (migration `0016`): SELECT on the tenant's rows; INSERT only `tenant_id, site_name, domain, site_url, listings_url, source` with the policy pinning `source = 'auto_detected'` and (column grant) the default `active = true`; UPDATE only `listings_url, status, status_detail, last_crawled_at, last_listing_count, content_hashes, updated_at`. It can never un-ignore, change `source`, move a row to another tenant or delete. The app can INSERT and UPDATE only `active`/`updated_at`. Verified on the dev database (20 checks, scraper + `app_tenant`).

Known limits: pages that only render with JavaScript read as empty (`statusDetail` says so); a broker whose listings sit behind a search form that needs POST/JS is not paginated; discovery via Brave also surfaces non-brokers (associations, directories) that end up `no_listings` — Ignore them.

## Real-time intake (`manual_assist`)

One service, three entry points, so the logic exists exactly once (`modules/leads/leads-ingest.service.ts`, `ingestRaw`):
**dedupe → AI extraction → record its spend → save**. Extraction runs only for a lead that is actually new (a re-submission costs nothing), and a failed AI step never loses the lead — it is saved with the source's own fields and flagged `extractionFallback`.

- **`POST /api/leads/ingest`** (`app/api/leads/ingest/route.ts`) — for you or a script, when a site blocks the scraper. `Authorization: Bearer <LEAD_INGEST_API_KEY>` (constant-time compare; if the env var is unset the endpoint answers 401 to everyone). Body: `tenantId` (**required**, no default, cross-checked against the `tenants` table), `sourceUrl` (required, http/https), `rawText` (required), `businessName?`, `note?` (kept on the lead and shown to the model as context). Responses: `201 {id, duplicate:false, extractionFallback}`, `200 {…, duplicate:true}` when the same URL is already there, `400` invalid body / unknown tenant, `401`, `429` (~20 requests/minute for the key — a Postgres fixed-window counter shared across serverless instances, `modules/rate-limit`; only authenticated requests count), `500`. Dedupe key: the URL with tracking params (`utm_*`, `fbclid`…), `www.`, fragment and trailing slash removed.
- **Leads Inbox quick-add** (`quickAddLeadAction`, tenant from the session) — one box: a lone link is fetched server-side (SSRF-guarded GET, `lib/safe-fetch.ts`) and read; anything else is taken as the text itself. If a page can't be read (many sites block bots) the lead is still saved with just the URL and the person is told to paste the text.
- **Web Share Target** (`app/manifest.ts` → `/share`) — Android/Chrome, installed PWA only: "Share → TAGR CRM" lands on `/share`, which just pre-fills the quick-add box (`/leads-inbox?add=…`) — it ingests nothing itself.

## Inbound email (`email_digest`)

`POST /api/webhooks/resend-inbound` handles Resend's `email.received`:

1. **Verify the signature** (Svix, via `resend.webhooks.verify`, over the raw body; includes the replay-window check). Invalid → `401`, nothing else happens.
2. The webhook is **metadata only** — the body is fetched with `resend.emails.receiving.get(email_id)`. If that fails the handler answers 5xx so Resend retries.
3. The tenant is **`INBOUND_EMAIL_TENANT_ID`** (our config, cross-checked against a real tenant — never taken from the payload; one inbox = one tenant for now).
4. **Confirmation check** (`modules/email-inbound/confirmation.ts`): deliberately conservative — every gate must pass: the subject contains confirm/verify/activate/opt-in and does *not* look like a listing/alert/digest; the body is short (≤ 2,500 chars); exactly **one** confirm-looking link (not unsubscribe/preferences). It must then match **exactly one** listed, not-yet-subscribed `email_sources` row by registrable domain (the source's site equals the sender's or the link's), and the link itself must sit on the sender's or the site's domain (we will GET it). A match → GET the link (SSRF-guarded); 2xx → the row is marked `subscribed` (+ `subscribedAt`) and **no lead is created**; a failed GET leaves `subscribed` alone and writes a note on the row. **Any doubt → it is not treated as a confirmation** and goes to step 5 (worst case a low-value lead someone dismisses; the alternative — a real listing silently skipped — is worse).
5. Otherwise the email is read as a **listing digest** (`leadsIngestService.ingestEmailListings`): ONE AI call (the second extraction contract in the shared spec, `listingsExtraction`) returns one object per business listed FOR SALE — a BizBuySell/BizQuest alert or a broker's weekly list holds many — and **each becomes its own `raw_leads` row** with `sourceType: "email_digest"`:
   - `sourceUrl` = **that listing's own link** (falls back to the sender's site when it has none). A link is only trusted if it is http(s) and appears *literally* in the email text — the model cannot hand us a URL it made up. The HTML version is read first because its links survive as `label (url)`.
   - its own price, revenue, cash flow (→ `annualProfitUsd`), employees, reason for selling and signals, with the numeric twins the search-profile criteria are checked against. Ads, "sell your business" blocks and unsubscribe text are ignored (verified on a realistic alert email).
   - `dedupeKey` = `email:<resend email id>:<n>` (n = position in the email, stable). **Idempotent per email**: a redelivered/replayed webhook is recognised (`existsForEmail`) *before* any AI call, so it creates nothing and costs nothing.
   - **The same listing re-sent in a later digest is skipped**: each lead stores `extractedFields.listingSignature` (hash of name + city/state + asking price; the normalised link when there is no name) and a new listing with a known signature is not saved again. A changed asking price counts as a different listing.
   - `rawText` = From/Subject + the full body on the **first** listing only; the others store a short pointer, instead of copying a 30k-character email N times.
   - If the AI step fails, or it runs and finds no business for sale (a welcome mail, a promo), the email is still kept as **one** plain lead (subject as its name, with a note saying which case) — nothing an email brought disappears silently.
6. **Spend**: each received email is logged as provider `resend`, operation `receive`. Resend has **no separate inbound price** — received emails count toward the account's monthly quota (Free: 3,000/mo and 100/day; Pro: 50k/mo, then US$ 0.90 per 1,000). The tracked figure is the overage rate, US$ 0.0009/email, as an upper bound; within your plan's quota the marginal cost is zero.

Cost: one AI call per email (~US$ 0.0004 for a four-listing alert on `gpt-4o-mini`; at most 15 listings and 30,000 characters are read per email), logged as `openai/extract`, plus one `resend/receive`. Known limits: email leads have **no search profile**, so they don't get a fit badge against a profile's criteria (a follow-up: let email leads be scored against a chosen criteria set); and a listing that only appears as a tracking redirect link with no name/price can't be recognised as a repeat.

## Email sources — tracking list and auto-signup

`email_sources` (tenant-scoped) is the list of listing sites that deliver by email: `siteName`, `signupUrl`, `subscribed`, `captchaProtected`, `notes`, `subscribedAt`, `source` (`manual` = a person added it in the CRM · `auto_detected` = a search profile run logged it, see below), plus `emailFieldSelector` / `submitSelector` (per-site CSS selectors for the signup form) and job-owned `lastAttempt*` / app-owned `attemptRequestedAt`. UI: Leads Inbox → *Email sources* (shows which rows were added by hand and which the engine found).

**Auto-detection during search runs.** Whether a site needs an email signup can't be known without looking, so a person can still add sites by hand — but the engine also looks while it works (`scraper/src/leadengine/enrich/email_signup_detect.py`). Each page the company-site enricher reads (homepage + one contact/about page of a candidate's website, robots.txt respected), and each results page the marketplace adapter finds empty, goes through a **precision-first heuristic that needs BOTH signals in the same `<form>`**: (1) a real email field (`<input type="email">`, or a text input clearly labelled as email) and (2) one of a small keyword set — *subscribe*, *get listings by email*, *email alerts*, *sign up to receive* (case-insensitive, word-bounded, so "unsubscribe" doesn't count) — in that form or its small enclosing section (≤ 3 ancestors, ≤ 600 chars; a keyword elsewhere on the page doesn't count). Forms with a password or a free-text message box (login/contact) are ignored. Neither signal alone is enough. A match:

- **upserts one `email_sources` row per registrable domain** — checked against *every* source of the tenant (added by hand or earlier by the engine, subscribed or not) *before* inserting, once per domain per run; a tracked domain is never logged again, which also keeps the confirmation-email matcher from ever facing two rows for one site;
- creates it as `source = 'auto_detected'`, `subscribed = false`, `captchaProtected = false` (unknown until an attempt runs), `siteName` from the page title (else the domain), `signupUrl` = the page where the form was found, `notes` = "Auto-detected during search profile run …", and — when they can be derived — the two selectors, so the existing signup automation can pick the row up on its next pass exactly like a manual one (a row without selectors stays a *Manual signup* in the UI);
- attempts **no signup** during the search run and creates **no raw lead** from the detection. (The candidate whose website was being read is still saved as a lead exactly as before — detection only *adds* a row to `email_sources`; it never suppresses a lead.)
- is counted in `lead_runs.email_sources_detected` (shown as "Email sources" in the spend page's recent runs) and logged (`New email-only source detected: …`; the profile line in the job log adds "N new email-only source(s) detected").

The DB enforces the limits, not just the code (migrations 0013–0014): the job can read every `email_sources` row of its own tenant, may INSERT only the columns `tenant_id, site_name, signup_url, email_field_selector, submit_selector, notes, source`, and the insert policy pins `source = 'auto_detected' and not subscribed and not captcha_protected` for that tenant. Known limit: the heuristic reads *static* HTML (a form rendered by JavaScript isn't seen), and only where the enricher runs (`company_site_scrape` on for the profile). Google Places and Brave Search themselves never open pages — they return records/URLs — so the pages they lead to are checked through the company-site enricher.

Subscribing, where possible, is automated in two halves that are **not** the same step as receiving:

1. **Signup attempt** — `python -m leadengine.email_signup` (Playwright; runs after the engine on the scheduled tick and when "Attempt subscribe" is clicked). It picks sources that are unsubscribed, not captcha-protected, have both selectors, and were never attempted *or* re-requested. It opens the page (robots.txt respected) and **reads the whole form** (`email_signup_form.py`, pure planner + in-page JS):
   - a **captcha widget inside the signup form** (reCAPTCHA / hCaptcha / Turnstile…) — or a "verify you're human" challenge on the page — stops it and sets `captchaProtected`; it never solves or bypasses one. A sitewide captcha *script* elsewhere on the page (a contact form) no longer counts. A challenge appearing after submit counts too;
   - it fills the inbox address (also a "confirm email" field), and — from `BUYER_NAME` / `BUYER_PHONE` / `BUYER_COMPANY` (Tanner / 480 282 2225 / TAGR Holdings) — name (first / last / full), phone and company fields, the industry option matching the profiles' industries (or an "all industries" option), "I am a **buyer**", a *how did you hear* option (search / online), and **only** marketing-consent checkboxes ("send me listings / alerts / newsletter") or industry checkboxes. Optional fields stay empty; **invisible fields (honeypots) are never touched**;
   - it hands the site to a person — `lastAttemptResult = manual`, the reason in `lastAttemptError` — **before typing anything** when the form wants a password/account, a file, an **NDA / terms / privacy-policy acceptance**, a captcha field, or any *required* field it has no answer for (a last name that isn't configured, a ZIP, a budget…). After the submit, a visible validation message or the browser's own "required" block also ends as `manual`; a thank-you on the page wins over a reset form;
   - otherwise it clicks submit and records `lastAttemptResult = submitted`. **It never sets `subscribed`** (double opt-in is the norm) and it never retries by itself, so a scheduled run can't spam a site.
2. **Confirmation** — the site's confirmation email arrives at the inbox and step 4 of *Inbound email* clicks the link and sets `subscribed`.

**Sites a person must do are shown on screen**: Email sources shows a red banner ("N sites need to be signed up to by hand") listing each site with its reason, a *Needs a person* / *Captcha* / *Last attempt failed* badge, and an *Open signup page* button — for `captcha`, `manual`, `failed`, and for a `submitted` form whose confirmation email has not arrived after 3 days (`signupHandoffReason()`, computed server-side). Sign up by hand with the inbox address, then use *Mark subscribed*.

## Qualification criteria and fit

A search profile can carry optional `criteria` (jsonb): min/max **revenue**, min/max **profit** (cash flow / SDE / EBITDA), max **asking price**, min/max **employees**, min **years in business**, and **signal keywords** ("retiring", "owner selling"). They **annotate, never filter**: a lead is never dropped for missing a criterion, because most sources don't state revenue at all and filtering would discard nearly everything.

- The extraction returns numeric twins of its text fields — `estimatedRevenueUsd`, `annualProfitUsd`, `askingPriceUsd`, `employeesCount`, `yearsInBusinessCount` — **only when the text explicitly states the figure** (a range → its midpoint; never estimated). Leads extracted before these fields existed simply have none (fit = unknown).
- The **job** matches the signal keywords against the lead's full text and stores `extractedFields.matchedSignals`.
- The **app** computes the fit when the inbox is listed (`modules/search-profiles/fit.ts`, pure, no AI): `match` (everything checkable passed) · `partial` (some passed, the rest unstated) · `miss` (a stated figure is outside the range) · `unknown` (nothing could be checked). Missing data is never a fail; keywords are a bonus and never lower a lead. Because it's computed on read, editing a profile's criteria re-scores existing leads immediately.

## Environment variables

| Where | Variable | Used by |
|---|---|---|
| Vercel (app) | `LEAD_INGEST_API_KEY` | `POST /api/leads/ingest` (a long random string) |
| Vercel | `RESEND_WEBHOOK_SECRET` | inbound webhook signature (`whsec_…`, from the Resend webhook page) |
| Vercel | `RESEND_API_KEY` | fetching the received email's body (already used for the contact form) |
| Vercel | `INBOUND_EMAIL_TENANT_ID` | which tenant owns the inbound inbox |
| Vercel | `OPENAI_API_KEY`, `OPENAI_MODEL?` | AI extraction of manual/email leads (the job has its own copy) |
| Vercel | `INBOUND_LEADS_ADDRESS?` | shown on the Email sources screen |
| Vercel (optional) | `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_REF?` | start the workflow immediately on "Run now" / "Attempt subscribe" (token: fine-grained, *Actions: read & write* on the repo) |
| GitHub Actions | secrets `DATABASE_URL_SCRAPER`, `GOOGLE_CLOUD_API_KEY`, `BRAVE_API_KEY`, `OPENAI_API_KEY`; variables `OPENAI_MODEL?`, `INBOUND_LEADS_ADDRESS`, `BUYER_NAME`, `BUYER_PHONE`, `BUYER_COMPANY` | the job (`BUYER_*`: who the email signups sign up as) |

The webhook URL to register in Resend is `https://crm.tagrholdings.com/api/webhooks/resend-inbound` (the CRM host — the marketing host would redirect a POST), event `email.received`.

## Run semantics

- A profile is *due* when it never ran, `lastRunAt + frequencyHours` has passed, `runState.resume` is set, or **`runRequestedAt` is set ("Run now")**. Starting a run clears `runRequestedAt`, so a request made mid-run queues another. "Run now" does **not** waive the profile's lead cap — that is the spend guard.
- A run walks `(source, term)` pairs (`terms` = category + keywords) for the enabled discovery sources, in a fixed order.
- **Cap reached** → run stamps `lastRunAt` and keeps the cursor (waits `frequencyHours`, then continues there). **Time limit** → `resume = true`, `lastRunAt` untouched (resumed on the next tick). **Cycle finished** → cursor cleared.
- One source failing (or missing credentials) is recorded in the run's `error` and the run continues with the others → status `partial`.
- One engine process at a time: a Postgres advisory lock + the workflow's `concurrency` group.

## AI extraction vs. analysis — two stages, don't conflate

1. **Extraction** (built): `extraction/` in the job. Provider today: OpenAI (`gpt-4o-mini` default, strict JSON-schema output); the project intends to move to Claude Haiku — only `extractor.py` and `pricing.py` change. Fills the fields above; never scores or ranks.
2. **Analysis/scoring** (deferred — checklist item 11): dedup across sources, fit score, outreach draft. Where it runs (job vs. a `leads` Service routine) and where its fields live (`raw_leads` columns vs. a `lead_analysis` table) are still open — document the choice here when decided.

## Promoting a raw lead into a pipeline item

"Add to pipeline" in the Leads Inbox → `promoteRawLeadAction` → `leadsService.promote`:

1. Atomically flips `status` `new → processed` (conditional UPDATE — a double click or second tab is rejected, not duplicated).
2. Via the other modules' **Services**: `pipelineService.ensureDefaultBoard`, `organizationsService.create` (reuses a same-named org), `contactsService.create` (only if the engine found contact data), `pipelineService.create` (Leads board, first stage, notes built from the extracted fields).
3. Sets `raw_leads.pipelineItemId`. If any step fails, the lead goes back to `new`.
4. Never deletes the raw lead. "Dismiss" only sets `dismissed`; "Restore" sets it back to `new`.

## What this document does NOT define yet

The exact `extractedFields` shape and the extraction prompt will keep evolving as sources are added — don't hard-code rigid assumptions about the shape in `modules/leads`. The analysis stage (checklist item 11: cross-source dedupe, scoring, outreach) is not built, and email leads aren't scored against any search profile's criteria yet (see *Inbound email*).
