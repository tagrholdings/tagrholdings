# Lead Pipeline — How the Scraper and AI Connect to the CRM

## Overview

The lead-discovery engine is a **separate** process from the Next.js app (a Python job, run via external scheduling — see `deploy-manager.md`). It doesn't import code from this repo or call Server Actions — it writes directly to the `raw_leads` table in the same Postgres database (Neon), always with `tenantId` populated.

The Next.js app never calls the scraper — the relationship between the two is asynchronous, via the shared database. The one nuance: "Run now" and "Attempt subscribe" record a request row-flag in the database first (that is the contract the job honors) and may additionally ask GitHub Actions to start the workflow right away (`lib/github-dispatch.ts`); if that isn't configured the request just waits for the next scheduled run. Leads that must appear in real time (manual adds, inbound email) don't wait for the job at all: the app extracts them itself with the same shared prompt/schema (`modules/lead-extraction/`, spec in `scraper/src/leadengine/shared/lead-engine-spec.json`).

## The two AI stages (don't conflate them)

1. **Extraction** (happens inside the scraper job, before writing to `raw_leads`): turns raw page text into structured fields. Runs outside Next.js.
2. **Analysis/scoring** (happens afterward, on data already in `raw_leads`): deduplicates, scores, and optionally drafts outreach copy. Can run either in the Python job or as a routine called by the `leads` module's Service inside Next.js — that's an implementation choice, but the conceptual distinction between the two stages must be preserved in code (separate functions/modules, not one function doing everything).

## `raw_leads` table contract

See `.agents/docs/LEAD_INGESTION.md` for the full schema. Rules that apply to this app's `leads` module:

- The `leads` module (inside `modules/leads/`) **reads and transforms** `raw_leads` — it doesn't write to it as the primary source (the external job does).
- When promoting a raw lead into a real pipeline item (`modules/pipeline`), the corresponding Action marks the raw lead as processed (status field) and creates the record in `pipeline_items` — never duplicating pipeline-item-creation logic in two places.
- Every `raw_lead` arrives with `tenantId` already set by the external job (based on the search profile that generated that run) — the Next.js `leads` module never infers or reassigns that value.

## Search Profiles

Configurable search profiles (category, region, active sources, qualification criteria) are managed by the CRM UI (`modules/search-profiles`), but **consumed** by the external Python job, not executed by it in real time inside Next.js. The flow is: user creates/edits a profile in the UI → the profile is saved to the database → the external job reads active profiles on its next scheduled run and searches accordingly.
