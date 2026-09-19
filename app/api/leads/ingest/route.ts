import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestLeadRequestSchema } from "@/modules/leads/leads.types";
import { leadsIngestService } from "@/modules/leads/leads-ingest.service";
import { rateLimitService } from "@/modules/rate-limit/rate-limit.service";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

/**
 * POST /api/leads/ingest — hand the CRM a lead you found by hand (or with a script) when the site
 * blocks the scraper: a URL plus the text you got from it. Not a Server Action: the caller has no
 * session, it authenticates with a shared key.
 *
 *   Authorization: Bearer <LEAD_INGEST_API_KEY>
 *   { "tenantId": "<uuid>", "sourceUrl": "https://…", "rawText": "…", "businessName"?: "…", "note"?: "…" }
 *
 * The lead is saved as sourceType "manual_assist", status "new", and goes through the same AI
 * extraction as every other source (leadsIngestService — one implementation, shared with the Leads
 * Inbox quick-add).
 */

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function keyMatches(header: string | null, expected: string): boolean {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1].trim());
  const wanted = Buffer.from(expected);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

export async function POST(request: Request) {
  const expectedKey = process.env.LEAD_INGEST_API_KEY;
  if (!expectedKey) {
    console.error("POST /api/leads/ingest: LEAD_INGEST_API_KEY is not set — the endpoint is disabled.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!keyMatches(request.headers.get("authorization"), expectedKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One shared bucket for the key: it limits damage from a leaked key, whatever IP it is used from.
  if (await rateLimitService.isLimited("leads-ingest", RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const parsed = ingestLeadRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 }
    );
  }
  const { tenantId, ...lead } = parsed.data;

  // No default tenant: the id must be a real one, cross-checked against the database.
  if (!(await tenancyService.tenantExists(tenantId))) {
    return NextResponse.json({ error: "Unknown tenantId." }, { status: 400 });
  }

  try {
    const result = await leadsIngestService.ingestManual(tenantId, lead);
    return NextResponse.json(
      { id: result.id, duplicate: result.duplicate, extractionFallback: result.extractionFallback },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/leads/ingest failed:", error);
    return NextResponse.json({ error: "Could not save the lead." }, { status: 500 });
  }
}
