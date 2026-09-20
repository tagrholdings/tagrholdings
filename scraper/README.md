# Lead engine (`scraper/`)

The automatic lead-discovery job. It reads active **search profiles** from the shared Postgres, searches Google Places / Brave Search (and, shelved, a marketplace), reads company websites, has an AI model turn the text into structured fields, and writes **raw leads** back — plus a record of every run and every paid API call (for the *Engine spend* page).

It is a separate process from the Next.js app: the two only meet in the database. Contract, tables and permissions: [`.agents/docs/LEAD_INGESTION.md`](../.agents/docs/LEAD_INGESTION.md). The user-facing explanation lives in the app at **/docs → How the lead engine works**.

## Flow of one run

```
main.py ─ takes a DB advisory lock (one run at a time)
  └─ db.due_profiles()              never ran / frequency elapsed / resume flag
       └─ Runner.run_profile(profile)
            plan = [(source, term) …]    terms = category + keywords; sources in fixed order
            for each (source, term), resuming from run_state.cursor:
              source.search() → pages of Candidates
                for each unknown candidate (dedupe key not in raw_leads):   ← known ones cost nothing
                  enrich/company_site   homepage + contact page → emails, phones, text   (robots-aware)
                  extraction/extractor  text → extractedFields (OpenAI, strict JSON schema)
                  db.insert_lead        ON CONFLICT DO NOTHING
                  usage recorded per paid call, immediately
            stop at the profile's lead cap or the time limit → checkpoint saved
```

| Module | Role |
|---|---|
| `sources/google_places.py` | Places API (New) text search; geocodes the city once (cached in `run_state`) for a location bias |
| `sources/brave_search.py` | Brave Search API, Web Search endpoint (needs `BRAVE_API_KEY`); up to 3 pages/term; drops directories, social sites and "N best …" roundup pages; one lead per site; retries a 429 once |
| `sources/marketplace/bizbuysell.py` | Playwright; robots.txt, polite delays, **gives up on any block/captcha** (see caveat) |
| `enrich/company_site.py` | requests + BeautifulSoup; refuses non-public hosts, honors robots.txt, size/time limits |
| `extraction/` | Stage 1 AI (extraction only — no scoring). Provider isolated here + `pricing.py` |
| `pricing.py` | **The one place** with list prices used for cost estimates |
| `db.py` | All SQL. Connects as `lead_scraper`; every write is inside a tenant-scoped transaction |
| `runner.py` | Orchestration, caps, deadline, checkpoint semantics |

## Setup

1. **Database role** — apply the Drizzle migrations (`npm run db:migrate` in the repo root; check `.neon` first), then on that branch:
   `ALTER ROLE lead_scraper PASSWORD '<generated>';` and build the connection string for it.
2. **Google Cloud** — one API key with **Places API (New)** and **Geocoding API** enabled. Without Geocoding the engine still works, just without the radius bias. (Custom Search is no longer used.)
3. **Brave Search** — an API key from https://api-dashboard.search.brave.com/ on the *Search* plan (US$ 5 per 1,000 requests, US$ 5 of free credit per month). Put it in `BRAVE_API_KEY`. Nothing else to configure; without it the Brave source is skipped.
4. `cp .env.example .env` and fill it in (`.env` is git-ignored).
5. Python 3.12+:
   ```
   python -m venv .venv && .venv/Scripts/activate      # or source .venv/bin/activate
   pip install -r requirements-dev.txt
   playwright install chromium                          # marketplace source only
   ```

## Running

```
# from scraper/
PYTHONPATH=src python -m leadengine.main                          # every profile that is due
PYTHONPATH=src python -m leadengine.main --profile-id <uuid> --max-leads 3   # cheap test of one profile
PYTHONPATH=src python -m leadengine.main --max-minutes 300        # what the scheduler runs
```

Flags: `--max-minutes N` (stop starting work, save checkpoint), `--profile-id ID` (repeatable; ignores schedule), `--force` (all active profiles regardless of schedule), `--max-leads N` (lowers the cap, never raises it).

Docker (same image for CI and the future server): `docker build -t tagr-lead-engine scraper/` then `docker run --rm --env-file scraper/.env tagr-lead-engine --max-minutes 5`.

Scheduled: `.github/workflows/lead-engine.yml` (every 6 h + manual dispatch). Repository secrets: `DATABASE_URL_SCRAPER`, `GOOGLE_CLOUD_API_KEY`, `BRAVE_API_KEY`, `OPENAI_API_KEY`; optional variables `OPENAI_MODEL`, `INBOUND_LEADS_ADDRESS` (needed for the email signups) and `BUYER_NAME` / `BUYER_PHONE` / `BUYER_COMPANY` (who the signups sign up as). Manual runs: Actions tab → Run workflow (`task`: `engine` or `email-signups`).

## Broker listing sites (businesses for sale)

Source `broker_listings` (`sources/broker_listings.py`, helpers in `util/pages.py`, `util/fetch.py`, `extraction/listings.py`). For a profile whose category + terms are *industries to buy* it discovers business brokers with Brave (weekly, ≤ 20 new sites, kept in the tenant's `listing_sites` list), then crawls each politely: finds the listings page, follows industry category links, the site's own GET keyword search and next pages, has the AI extract every listing, keeps the ones in the wanted industries (skipping sold ones) and saves **one lead per listing** with the listing's own link. Unchanged pages cost no AI call. Sites that refuse (robots.txt, 401/403/429) are recorded as `blocked` and shown in the CRM for a person — never worked around. A profile for this mode wants a higher lead cap (≈ 100) and weekly frequency (168 h). Details: `.agents/docs/LEAD_INGESTION.md` → *Broker listing sites*.

## Email-source signups

`python -m leadengine.email_signup` (also run after the engine on every scheduled tick, and on its own when "Attempt subscribe" is clicked in the CRM) subscribes the dedicated leads inbox (`INBOUND_LEADS_ADDRESS`) to listing sites that deliver by email. For each `email_sources` row that is unsubscribed, not captcha-protected, has both selectors configured, and was never attempted or explicitly re-requested, it opens the signup page with Playwright, types the address into the configured email field and clicks the configured submit button.

- **Captcha → stop.** reCAPTCHA / hCaptcha / Turnstile / Arkose markup before submitting, or a "verify you're human" challenge after, sets `captcha_protected` and leaves the site a manual signup. It never solves or bypasses one.
- **It never sets `subscribed`.** Most sites use double opt-in; a submitted form is only recorded as `last_attempt_result = submitted`. The site's confirmation email reaches the inbox and the CRM's inbound webhook (`modules/email-inbound`) clicks the link and marks the site subscribed.
- **The form is read, not just the email box** (`email_signup_form.py`): name / phone / company are filled from `BUYER_NAME` / `BUYER_PHONE` / `BUYER_COMPANY`, the industry choice from the tenant's profiles, marketing-consent boxes are ticked. An NDA / terms / privacy checkbox, a password, a file upload, a captcha field or a required field with no configured answer ends the attempt as `manual` (with the reason) **before anything is typed**; the CRM flags the site for a person. Only a captcha inside the signup form counts, not a sitewide script.
- Selectors are configured per site in the CRM (Leads Inbox → Email sources) — no guessing. One attempt per request: nothing is retried by itself.
- Exits 0 immediately when nothing is due, so it needs no setup on ticks where there's no work.

## Email-only site detection

While a run reads pages, it also asks one question of each: *is this a page that offers listings only by email signup?* `enrich/email_signup_detect.py` (pure, HTML in → detection out) flags a form only when it has **both** an email field **and** one of *subscribe / get listings by email / email alerts / sign up to receive* in the same form or small section — precision over recall; login/contact forms are ignored. It runs on the pages `company_site.py` reads and on the marketplace adapter's empty results pages (`SourceContext.on_empty_page`). A match becomes one `email_sources` row per registrable domain (`source = auto_detected`, unsubscribed, selectors filled in when derivable) via `Database.record_email_source_detection`, which checks the tenant's existing rows first. No signup happens in the run and no lead is created from the detection; `email_signup.py` picks the row up on its next pass. Each run reports how many it found (`lead_runs.email_sources_detected`, the job log, the spend page).

## "Run now" and qualification criteria

- A search profile with `run_requested_at` set (the CRM's **Run now** button) is treated as due whatever its `frequency_hours`; starting the run clears the flag. The run still obeys the profile's lead cap. The CRM may also start the workflow immediately through the GitHub API; otherwise the request waits for the next scheduled tick.
- If a profile has `criteria.signalKeywords`, each new lead's full text is scanned for them (`criteria.py`) and the hits are stored as `extractedFields.matchedSignals`. The numeric criteria (revenue, profit, size…) are evaluated by the app against the extraction's numeric fields, so they never need the job.

## Shared extraction spec

The AI prompt, strict JSON schema and OpenAI price table are in `src/leadengine/shared/lead-engine-spec.json` — the same file the Next.js app imports (it extracts manual and inbound-email leads in real time). Edit prompt/schema/prices there only. The mapping from model output to `extractedFields` exists in Python (`extractor.py`) and TypeScript (`modules/lead-extraction`); `tests/fixtures/extraction_golden.json` is asserted by both suites so they can't drift.

## Tests

```
pytest            # no network, no database, no real API calls
```

Covers the shared-spec golden mapping, signal-keyword matching, the email-signup automation (captcha detection, fake-page attempts, "never marks subscribed" pinned at SQL level), pricing, robots/URL safety, the Places and Brave Search adapters (mock HTTP: request shape, auth header, paging, 429 retry, roundup filtering, billing only for accepted calls), HTML parsers, the extractor (fake client) and the runner (fake DB: dedupe-before-spend, cap, deadline/resume, source failures, extractor failure).

## Costs and safeguards

- Every paid call is written to `lead_api_usage` with an **estimated list-price cost** the moment it happens; free tiers/credits aren't subtracted. Update the prices when a provider changes them (OpenAI's live in the shared spec JSON, the rest in `pricing.py`) (verify against Google Maps Platform and OpenAI pricing pages).
- Spend guards: per-profile **max new leads per run**; known candidates skip enrichment and AI entirely; AI input is capped (~6k chars/lead).
- A `--max-leads` cap on a first run is strongly recommended after any change to a profile's terms.
- Secrets never go in logs: `httpx`'s request logging (which prints URLs, and Google's APIs take the key as a query parameter) is silenced in `main.py`. Restrict the Google key to the three APIs in Google Cloud.

## Known limitations

- **Marketplace (BizBuySell) — shelved**: the site blocks bots and no bypass is being pursued; leave "Marketplaces" off on every profile. Written from its public URL scheme and **not verified against the live site**; these sites use bot protection and restrict automated access. The adapter stops on the first block and never circumvents it. Adjust `_LISTING_HREF` / `parse_listings` in `sources/marketplace/bizbuysell.py` when you first run it for real, or leave "Marketplaces" off.
- Google Places radius is a *bias* (max ≈ 31 mi), not a hard filter; a resumed term restarts from page 1 (known results are skipped, but the page is billed again).
- No cross-source dedup (the same business from Places and Search appears twice) and no scoring — both are checklist item 11.
- Broker crawler: pages that only render with JavaScript read as empty; a listings search that needs POST/JS isn't paginated; Brave discovery also surfaces non-brokers (they end `no_listings` — Ignore them in the CRM).
- Signups: the form planner is keyword-based — an unusual required field is handed to a person rather than guessed; a hidden-but-required control can only be detected after the submit (the browser's validity check).
