# Lead Ingestion — Contract Between the External Job and the CRM

## Who writes, who reads

- **Writes to `raw_leads`**: the external Python job (scraper + AI extraction stage), running outside this Next.js repo — today via a scheduled GitHub Actions run, eventually on a dedicated server.
- **Reads and transforms `raw_leads`**: this app's `modules/leads` module, through that module's Service/Repository.

No code in this Next.js repo runs scraping or calls the AI extraction stage directly — that responsibility belongs entirely to the external job.

## Expected `raw_leads` schema (reference — adjust together with `modules/leads/leads.schema.ts` as the project evolves)

Fields the external job is responsible for populating on insert:

- `id`
- `tenantId` — determined by the search profile (`search_profiles`) that originated the run
- `sourceType` — e.g. `"google_places"`, `"google_custom_search"`, `"marketplace_scrape"`, `"company_site_scrape"`
- `sourceUrl` — original link the data came from
- `businessName`
- `rawText` — raw text extracted from the page/listing, before the AI extraction stage (kept for auditing/reprocessing)
- `extractedFields` — JSON with the fields the AI extraction stage produced (industry, location, estimated revenue, reason for selling, contact, etc.) — the exact shape of this JSON will evolve, so treat it as a flexible structure, not fixed columns
- `status` — `"new"` | `"processed"` | `"dismissed"` (updated by this app's `leads` module when the user promotes or dismisses the lead)
- `createdAt`

## Analysis/scoring stage (dedup, score, outreach draft)

Can run in the Python job (before writing to `raw_leads`) or as a separate routine called by the `leads` module's Service on already-written leads — implementation decision still open; document here which path was chosen once decided. Either way, the resulting fields (`fitScore`, `duplicateOfId`, `suggestedOutreachDraft`) belong either on the same `raw_leads` record or on a related `lead_analysis` table — to be decided together with the Model & Schema skill when this stage is implemented.

## Promoting a raw lead into a pipeline item

When the user triggers "Add to pipeline" from the leads inbox, the corresponding Action (`modules/leads/leads.actions.ts`):

1. Creates a `pipeline_item` (and optionally an `organization`/`contact`, if they don't already exist) using the data from `extractedFields`.
2. Updates `raw_leads.status` to `"processed"`.
3. Never deletes the `raw_leads` record — it stays as history/audit trail of where the pipeline item came from.

## What this document does NOT define yet

The exact shape of `extractedFields` and the prompt used in the AI extraction stage aren't fixed — they'll evolve as more source types are added. Don't hard-code rigid assumptions about this shape in `modules/leads` without first checking the current state of the Python job.
