import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { DEFAULT_BOARD_COLUMNS, DEFAULT_BOARD_NAME } from "../modules/pipeline/pipeline.constants";

/**
 * Fills an (already wiped) DEVELOPMENT database with believable demo data, for previews and demos: three workspaces —
 * "Tagr Holdings" (everything), "Menlo CRE" (a little) and "Menlo Dental Transitions" (empty, to show the empty pages).
 * It makes up leads, contacts, organizations, a Leads board and several projects, activities of every kind, search
 * profiles with their runs and spend, listing sites, email sources, discovered leads waiting in Sourcing and
 * emails received in Settings → Inbox.
 *
 * Like scripts/migrate-explicit.ts it never reads the repo's env files or `.neon`: you type the database, and the host
 * must match. It also refuses the production host outright, and refuses to run if any workspace already exists.
 * The super admin (the only account) is made an admin of all three workspaces so they show up in the switcher.
 *
 * Usage:
 *   SEED_DATABASE_URL="postgresql://...unpooled-host.../neondb?..." \
 *   SEED_EXPECT_HOST="ep-blue-flower" \
 *   npx tsx scripts/seed-demo.ts
 */
const connectionString = process.env.SEED_DATABASE_URL;
const expectHost = process.env.SEED_EXPECT_HOST;
if (!connectionString) throw new Error("Set SEED_DATABASE_URL to the exact connection string to seed.");
if (!expectHost) throw new Error("Set SEED_EXPECT_HOST to a substring of the expected database host, as a safety check.");
const host = new URL(connectionString).host;
if (!host.includes(expectHost)) throw new Error(`Refusing to run: host "${host}" does not contain expected "${expectHost}".`);
if (host.includes("weathered-wind")) throw new Error("Refusing to seed demo data into production.");

// Inbound email finds its workspace by the workspace's own address (`inbound_local_part`), so the id can be anything.
const TAGR_TENANT_ID = randomUUID();

const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;
/** `daysAgo` days back (negative = ahead) at `hour`:`minute` local time. */
function at(daysAgo: number, hour = 9, minute = 0): Date {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M` : `$${Math.round(n / 1000)}K`);

type Row = Record<string, unknown>;
const prepared = (v: unknown) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

async function insert(db: PoolClient, table: string, row: Row) {
  const keys = Object.keys(row);
  await db.query(
    `insert into public.${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
    keys.map((k) => prepared(row[k]))
  );
}

interface Ctx {
  db: PoolClient;
  tenantId: string;
  adminId: string;
}

function tenantRow(name: string, tenantSlug: string, id: string, buyer?: [string, string, string]) {
  return {
    id,
    name,
    slug: tenantSlug,
    inbound_local_part: `${tenantSlug}-${randomBytes(3).toString("hex")}`,
    buyer_name: buyer?.[0] ?? null,
    buyer_phone: buyer?.[1] ?? null,
    buyer_company: buyer?.[2] ?? null,
    created_at: at(40),
  };
}

// ───────────────────────────── Tagr Holdings (full) ─────────────────────────────

async function seedTagr({ db, tenantId, adminId }: Ctx) {
  const T = tenantId;
  const ids = (names: string[]) => Object.fromEntries(names.map((n) => [n, randomUUID()])) as Record<string, string>;

  // Organizations
  const orgs: [string, string, string | null][] = [
    ["Cool Air Mechanical", "https://coolairmechanical.example", "HVAC contractor, 22 years, owner retiring. Our lead acquisition."],
    ["Desert Breeze Heating & Air", "https://desertbreezehvac.example", "Residential service + replacement. Two locations."],
    ["Sonoran Plumbing Co.", "https://sonoranplumbing.example", null],
    ["Valley Pest Solutions", "https://valleypest.example", "Recurring-revenue pest control, ~1,900 customers."],
    ["Copper State Electric", "https://copperstateelectric.example", null],
    ["Saguaro Roofing", "https://saguaroroofing.example", "Seasonal; strong referral book."],
    ["Mesa Garage Door Pros", "https://mesagaragedoors.example", "Acquired last quarter — now in integration."],
    ["Ironwood Landscaping", "https://ironwoodlandscape.example", null],
    ["Pinnacle Business Brokers", "https://pinnaclebb.example", "Broker. Sends a weekly digest."],
    ["Southwest Biz Advisors", "https://swbizadvisors.example", "Broker, strong in trades businesses."],
    ["Arizona Commerce Lender", "https://azcommercelender.example", "SBA 7(a) lender we use on every deal."],
    ["Sandstone Legal Group", "https://sandstonelegal.example", "Deal counsel."],
  ];
  const orgId: Record<string, string> = {};
  for (const [i, [name, website, notes]] of orgs.entries()) {
    orgId[name] = randomUUID();
    await insert(db, "organizations", { id: orgId[name], tenant_id: T, name, website, notes, created_at: at(38 - i), updated_at: at(38 - i) });
  }

  // Contacts
  const people: [string, string | null, string | null, string | null][] = [
    ["Dale Hutchins", "Cool Air Mechanical", "dale@coolairmechanical.example", "(602) 555-0114"],
    ["Marisol Vega", "Cool Air Mechanical", "marisol@coolairmechanical.example", "(602) 555-0123"],
    ["Greg Pruitt", "Desert Breeze Heating & Air", "greg@desertbreezehvac.example", "(480) 555-0171"],
    ["Janelle Ortiz", "Sonoran Plumbing Co.", "janelle@sonoranplumbing.example", "(480) 555-0188"],
    ["Tom Brandvold", "Valley Pest Solutions", "tom@valleypest.example", "(623) 555-0102"],
    ["Priya Raman", "Copper State Electric", "priya@copperstateelectric.example", null],
    ["Luis Carrillo", "Saguaro Roofing", "luis@saguaroroofing.example", "(602) 555-0165"],
    ["Beth Calloway", "Mesa Garage Door Pros", "beth@mesagaragedoors.example", "(480) 555-0139"],
    ["Hank Doyle", "Ironwood Landscaping", null, "(480) 555-0150"],
    ["Rachel Kim", "Pinnacle Business Brokers", "rachel@pinnaclebb.example", "(602) 555-0190"],
    ["Marcus Bell", "Pinnacle Business Brokers", "marcus@pinnaclebb.example", "(602) 555-0191"],
    ["Elena Fischer", "Southwest Biz Advisors", "elena@swbizadvisors.example", "(480) 555-0144"],
    ["Owen Patel", "Arizona Commerce Lender", "opatel@azcommercelender.example", "(602) 555-0107"],
    ["Diane Whitaker", "Sandstone Legal Group", "dwhitaker@sandstonelegal.example", "(602) 555-0128"],
    ["Rapid Rooter — main line", null, null, "(480) 555-0199"],
    ["Carlos Medina", null, "carlos.medina@example.com", "(623) 555-0177"],
    ["Samantha Reyes", null, "sam.reyes@example.com", null],
    ["Wes Tanaka", "Southwest Biz Advisors", "wes@swbizadvisors.example", null],
  ];
  const contactId: Record<string, string> = {};
  for (const [i, [name, org, email, phone]] of people.entries()) {
    contactId[name] = randomUUID();
    await insert(db, "contacts", {
      id: contactId[name],
      tenant_id: T,
      organization_id: org ? orgId[org] : null,
      name,
      email,
      phone,
      created_at: at(36 - i),
      updated_at: at(36 - i),
    });
  }

  // Boards
  const leadsBoard = randomUUID();
  await insert(db, "pipeline_boards", { id: leadsBoard, tenant_id: T, name: DEFAULT_BOARD_NAME, columns: DEFAULT_BOARD_COLUMNS, is_system: true, created_at: at(40) });

  const projectDefs: { name: string; columns: string[]; archived?: boolean }[] = [
    { name: "Due diligence — Cool Air Mechanical", columns: ["To do", "In progress", "Waiting on seller", "Done"] },
    { name: "Integration — Mesa Garage Door", columns: ["Day 1", "First 30 days", "First 90 days", "Complete"] },
    { name: "Vendor onboarding", columns: ["Contacted", "Negotiating", "Signed"] },
    { name: "Marketing — Q4 broker outreach", columns: ["Idea", "Drafting", "Sent", "Replied"] },
    { name: "2024 pilot (archived)", columns: ["To do", "Done"], archived: true },
  ];
  const boardId: Record<string, string> = {};
  for (const [i, p] of projectDefs.entries()) {
    boardId[p.name] = randomUUID();
    await insert(db, "pipeline_boards", {
      id: boardId[p.name],
      tenant_id: T,
      name: p.name,
      columns: p.columns.map((label) => ({ id: slug(label), label })),
      is_system: false,
      archived_at: p.archived ? at(60) : null,
      created_at: at(30 - i * 3),
    });
  }

  // Pipeline items. [board, title, stage label, org, contact, notes, createdDaysAgo]
  const leadItems: [string, string, string, string | null, string | null, string | null, number][] = [
    ["Leads", "Cool Air Mechanical — HVAC (Phoenix)", "Diligence", "Cool Air Mechanical", "Dale Hutchins", "LOI signed. Revenue ~$2.4M, owner retiring in Q1. Financing via Arizona Commerce Lender.", 30],
    ["Leads", "Desert Breeze Heating & Air", "Offer Submitted", "Desert Breeze Heating & Air", "Greg Pruitt", "Offer at 3.1x SDE. Waiting for their counter.", 24],
    ["Leads", "Camelback HVAC", "Offer Submitted", null, "Carlos Medina", "Broker listing, strong maintenance-agreement book.", 20],
    ["Leads", "Sonoran Plumbing Co.", "In Discussion", "Sonoran Plumbing Co.", "Janelle Ortiz", "Two calls so far. Wants to stay on 12 months.", 18],
    ["Leads", "Saguaro Roofing", "In Discussion", "Saguaro Roofing", "Luis Carrillo", "Seasonal revenue — asked for 3 years of financials.", 15],
    ["Leads", "Valley Pest Solutions", "Outreach", "Valley Pest Solutions", "Tom Brandvold", "First email sent, follow-up scheduled.", 11],
    ["Leads", "Ironwood Landscaping", "Outreach", "Ironwood Landscaping", "Hank Doyle", null, 9],
    ["Leads", "AZ Fire Protection Inc.", "Outreach", null, null, "Found through the broker digest.", 7],
    ["Leads", "Gilbert Janitorial", "Outreach", null, "Samantha Reyes", null, 6],
    ["Leads", "Copper State Electric", "Sourced", "Copper State Electric", "Priya Raman", null, 5],
    ["Leads", "Rapid Rooter Drain Service", "Sourced", null, "Rapid Rooter — main line", "Google Places find. No financials yet.", 4],
    ["Leads", "Phoenix Pool Service Route", "Sourced", null, null, null, 3],
    ["Leads", "Tempe Appliance Repair", "Sourced", null, null, null, 2],
    ["Leads", "Mesa Garage Door Pros", "Closed", "Mesa Garage Door Pros", "Beth Calloway", "Closed 3 months ago. Integration tracked in its own project.", 28],
  ];
  const projectItems: [string, string, string, string | null, string | null, string | null, number][] = [
    ["Due diligence — Cool Air Mechanical", "Quality of earnings review", "In progress", "Cool Air Mechanical", "Dale Hutchins", "CPA engaged; draft due Friday.", 20],
    ["Due diligence — Cool Air Mechanical", "Equipment and vehicle inventory", "To do", "Cool Air Mechanical", null, null, 19],
    ["Due diligence — Cool Air Mechanical", "Customer concentration analysis", "To do", null, null, "Top 10 customers by revenue.", 19],
    ["Due diligence — Cool Air Mechanical", "Employee roster and licenses", "Waiting on seller", "Cool Air Mechanical", "Marisol Vega", "Marisol sending the license list.", 18],
    ["Due diligence — Cool Air Mechanical", "Lease review (two locations)", "In progress", "Sandstone Legal Group", "Diane Whitaker", null, 17],
    ["Due diligence — Cool Air Mechanical", "Insurance and claims history", "Done", null, null, null, 16],
    ["Due diligence — Cool Air Mechanical", "Lender package", "Done", "Arizona Commerce Lender", "Owen Patel", "Submitted; term sheet received.", 15],
    ["Integration — Mesa Garage Door", "Move payroll to our provider", "Day 1", null, null, null, 25],
    ["Integration — Mesa Garage Door", "Re-brand trucks and invoices", "First 30 days", null, "Beth Calloway", null, 24],
    ["Integration — Mesa Garage Door", "Merge dispatch software", "First 90 days", null, null, "Evaluate before committing.", 23],
    ["Integration — Mesa Garage Door", "Customer announcement email", "Complete", null, null, null, 24],
    ["Integration — Mesa Garage Door", "Vendor terms review", "First 30 days", null, null, null, 22],
    ["Vendor onboarding", "Parts supplier — Rhino Supply", "Negotiating", null, null, "Wants net-30; we asked for net-45.", 14],
    ["Vendor onboarding", "Fleet fuel cards", "Signed", null, null, null, 13],
    ["Vendor onboarding", "Uniform provider", "Contacted", null, null, null, 6],
    ["Vendor onboarding", "Liability insurance broker", "Contacted", null, null, null, 5],
    ["Vendor onboarding", "Payment processor", "Negotiating", null, null, null, 4],
    ["Marketing — Q4 broker outreach", "Intro email to Pinnacle brokers", "Replied", "Pinnacle Business Brokers", "Rachel Kim", "Rachel wants our buy box in writing.", 12],
    ["Marketing — Q4 broker outreach", "One-page buy box PDF", "Sent", null, null, null, 11],
    ["Marketing — Q4 broker outreach", "Coffee with Southwest Biz Advisors", "Drafting", "Southwest Biz Advisors", "Elena Fischer", null, 8],
    ["Marketing — Q4 broker outreach", "LinkedIn post: what we buy", "Idea", null, null, null, 3],
    ["Marketing — Q4 broker outreach", "Referral thank-you notes", "Idea", null, null, null, 2],
    ["2024 pilot (archived)", "Test the intake form", "Done", null, null, null, 90],
    ["2024 pilot (archived)", "Old broker list cleanup", "To do", null, null, null, 88],
  ];
  const itemId: Record<string, string> = {};
  const boardColumns = (board: string) => (board === "Leads" ? DEFAULT_BOARD_COLUMNS : projectDefs.find((p) => p.name === board)!.columns.map((label) => ({ id: slug(label), label })));
  for (const [board, title, stageLabel, org, contact, notes, ago] of [...leadItems, ...projectItems]) {
    const id = randomUUID();
    itemId[title] = id;
    const stage = boardColumns(board).find((c) => c.label === stageLabel)!.id;
    await insert(db, "pipeline_items", {
      id,
      tenant_id: T,
      board_id: board === "Leads" ? leadsBoard : boardId[board],
      title,
      stage,
      contact_id: contact ? contactId[contact] : null,
      organization_id: org ? orgId[org] : null,
      notes,
      created_at: at(ago),
      updated_at: at(Math.max(0, ago - 2)),
    });
  }

  // Activities
  interface Act {
    type: "call" | "meeting" | "task" | "email" | "follow_up";
    subject: string;
    due: Date | null;
    priority?: "low" | "medium" | "high";
    done?: boolean;
    notify?: boolean;
    notes?: string;
    contact?: string;
    org?: string;
    item?: string;
    mine?: boolean;
    created?: number;
  }
  const acts: Act[] = [
    { type: "call", subject: "Call Dale about the QoE draft", due: at(2, 10), priority: "high", contact: "Dale Hutchins", item: "Cool Air Mechanical — HVAC (Phoenix)", mine: true, created: 5 },
    { type: "task", subject: "Send counter-offer to Greg Pruitt", due: at(1, 16), priority: "high", contact: "Greg Pruitt", item: "Desert Breeze Heating & Air", mine: true, created: 6 },
    { type: "meeting", subject: "LOI review with Sandstone Legal", due: at(0, 14), priority: "high", notify: true, org: "Sandstone Legal Group", contact: "Diane Whitaker", item: "Cool Air Mechanical — HVAC (Phoenix)", mine: true, created: 4 },
    { type: "call", subject: "Intro call — Valley Pest Solutions", due: at(0, 11, 30), priority: "medium", notify: true, contact: "Tom Brandvold", item: "Valley Pest Solutions", mine: true, created: 3 },
    { type: "email", subject: "Follow up on Saguaro financials", due: at(0, 17), priority: "medium", contact: "Luis Carrillo", item: "Saguaro Roofing", created: 3 },
    { type: "follow_up", subject: "Check in with Pinnacle on new HVAC listings", due: at(-1, 9), priority: "low", contact: "Rachel Kim", org: "Pinnacle Business Brokers", created: 4 },
    { type: "task", subject: "Review lender term sheet", due: at(-1, 15), priority: "high", notify: true, contact: "Owen Patel", item: "Lender package", mine: true, created: 5 },
    { type: "meeting", subject: "Site visit — Cool Air Mechanical shop", due: at(-2, 8, 30), priority: "high", contact: "Dale Hutchins", item: "Cool Air Mechanical — HVAC (Phoenix)", mine: true, created: 7 },
    { type: "call", subject: "Reference call with a Mesa Garage Door customer", due: at(-2, 13), priority: "low", contact: "Beth Calloway", created: 2 },
    { type: "task", subject: "Update the buy box one-pager", due: at(-3, 10), priority: "medium", item: "One-page buy box PDF", created: 8 },
    { type: "email", subject: "Send NDA to Camelback HVAC", due: at(-3, 16), priority: "medium", contact: "Carlos Medina", item: "Camelback HVAC", created: 2 },
    { type: "meeting", subject: "Coffee with Elena (Southwest Biz Advisors)", due: at(-5, 9), priority: "low", contact: "Elena Fischer", org: "Southwest Biz Advisors", item: "Coffee with Southwest Biz Advisors", created: 9 },
    { type: "task", subject: "Reconcile Q3 vendor invoices", due: at(-7, 12), priority: "low", mine: true, created: 1 },
    { type: "follow_up", subject: "Revisit Ironwood Landscaping in January", due: at(-30, 9), contact: "Hank Doyle", item: "Ironwood Landscaping", created: 9 },
    { type: "task", subject: "Draft the post-close 30-day plan", due: null, priority: "medium", item: "Re-brand trucks and invoices", created: 10 },
    { type: "task", subject: "Collect employee licenses from Marisol", due: at(1, 12), priority: "medium", contact: "Marisol Vega", item: "Employee roster and licenses", notify: true, created: 6 },
    // Overdue and still open
    { type: "call", subject: "Call back Janelle — pricing question", due: at(4, 15), priority: "high", contact: "Janelle Ortiz", item: "Sonoran Plumbing Co.", mine: true, created: 9 },
    { type: "email", subject: "Request 3 years of tax returns from Saguaro", due: at(6, 10), priority: "medium", contact: "Luis Carrillo", item: "Saguaro Roofing", created: 10 },
    // Done
    { type: "meeting", subject: "Kickoff with Cool Air owner", due: at(25, 10), priority: "high", done: true, contact: "Dale Hutchins", item: "Cool Air Mechanical — HVAC (Phoenix)", created: 29 },
    { type: "call", subject: "Initial call — Desert Breeze", due: at(21, 14), priority: "medium", done: true, contact: "Greg Pruitt", item: "Desert Breeze Heating & Air", created: 23 },
    { type: "task", subject: "Submit lender package", due: at(12, 12), priority: "high", done: true, contact: "Owen Patel", item: "Lender package", created: 16 },
    { type: "email", subject: "Send customer announcement", due: at(20, 9), priority: "medium", done: true, item: "Customer announcement email", created: 22 },
    { type: "follow_up", subject: "Thank Rachel for the intro", due: at(10, 16), priority: "low", done: true, contact: "Rachel Kim", created: 11 },
    { type: "task", subject: "Sign the NDA for Cool Air", due: at(27, 11), priority: "medium", done: true, item: "Cool Air Mechanical — HVAC (Phoenix)", created: 28 },
    { type: "call", subject: "Weekly check-in with counsel", due: at(8, 9), done: true, contact: "Diane Whitaker", org: "Sandstone Legal Group", created: 9 },
    { type: "meeting", subject: "Mesa Garage Door closing", due: at(28, 10), priority: "high", done: true, contact: "Beth Calloway", item: "Mesa Garage Door Pros", created: 35 },
    { type: "task", subject: "Order new truck decals", due: at(9, 13), priority: "low", done: true, item: "Re-brand trucks and invoices", created: 14 },
    { type: "email", subject: "Introduce ourselves to Rhino Supply", due: at(13, 10), priority: "low", done: true, item: "Parts supplier — Rhino Supply", created: 15 },
  ];
  for (const a of acts) {
    await insert(db, "activities", {
      id: randomUUID(),
      tenant_id: T,
      type: a.type,
      subject: a.subject,
      due_date: a.due,
      done: a.done ?? false,
      priority: a.priority ?? null,
      notes: a.notes ?? null,
      contact_id: a.contact ? contactId[a.contact] : null,
      organization_id: a.org ? orgId[a.org] : null,
      pipeline_item_id: a.item ? itemId[a.item] : null,
      assigned_to_user_id: a.mine ? adminId : null,
      created_by_user_id: adminId,
      notify: a.notify ?? false,
      created_at: at(a.created ?? 7),
      updated_at: at(Math.max(0, (a.created ?? 7) - 1)),
    });
  }

  // Search profiles
  const profiles: { key: string; row: Row }[] = [
    {
      key: "hvac",
      row: {
        name: "HVAC — Phoenix metro (brokers)",
        category: "HVAC contractors",
        keywords: ["HVAC", "air conditioning", "heating and cooling"],
        city: "Phoenix",
        state: "AZ",
        radius_miles: 40,
        location_scope: "radius",
        sources: { google_places: true, brave_search: false, broker_listings: true, company_site_scrape: true, marketplace_scrape: false },
        max_leads_per_run: 100,
        frequency_hours: 168,
        criteria: { minRevenue: 1_000_000, maxRevenue: 5_000_000, minProfit: 250_000, maxAskingPrice: 3_500_000, signalKeywords: ["retiring", "owner selling"] },
        active: true,
        last_run_at: at(1, 6),
      },
    },
    {
      key: "plumbing",
      row: {
        name: "Plumbing & drain — Mesa",
        category: "Plumbers",
        keywords: ["plumbing", "drain cleaning"],
        city: "Mesa",
        state: "AZ",
        radius_miles: 25,
        location_scope: "state",
        sources: { google_places: true, brave_search: true, broker_listings: false, company_site_scrape: true, marketplace_scrape: false },
        max_leads_per_run: 25,
        frequency_hours: 24,
        criteria: { minRevenue: 500_000 },
        active: true,
        last_run_at: at(0, 5),
      },
    },
    {
      key: "pest",
      row: {
        name: "Pest control — East Valley",
        category: "Pest control",
        keywords: ["pest control", "termite"],
        city: "Gilbert",
        state: "AZ",
        radius_miles: 30,
        location_scope: "radius",
        sources: { google_places: true, brave_search: false, broker_listings: false, company_site_scrape: false, marketplace_scrape: true },
        max_leads_per_run: 25,
        frequency_hours: 72,
        criteria: null,
        active: false,
        last_run_at: at(19, 6),
      },
    },
  ];
  const profileId: Record<string, string> = {};
  for (const p of profiles) {
    profileId[p.key] = randomUUID();
    await insert(db, "search_profiles", { id: profileId[p.key], tenant_id: T, ...p.row, created_at: at(35), updated_at: at(3) });
  }

  // Runs + spend
  const runs: [string, "completed" | "partial" | "failed", number, number, number, number, string | null][] = [
    // profile, status, daysAgo, seen, added, emailSources, error
    ["hvac", "completed", 15, 64, 22, 1, null],
    ["hvac", "completed", 8, 71, 17, 0, null],
    ["hvac", "partial", 1, 90, 21, 2, null],
    ["plumbing", "completed", 6, 38, 9, 0, null],
    ["plumbing", "failed", 3, 0, 0, 0, "Google Places request quota exceeded — will retry on the next run."],
    ["plumbing", "completed", 0, 33, 8, 0, null],
    ["pest", "completed", 19, 41, 6, 1, null],
  ];
  const runIds: string[] = [];
  for (const [key, status, ago, seen, added, emailSources, error] of runs) {
    const id = randomUUID();
    runIds.push(id);
    await insert(db, "lead_runs", {
      id,
      tenant_id: T,
      search_profile_id: profileId[key],
      status,
      started_at: at(ago, 6),
      finished_at: at(ago, 6, status === "failed" ? 1 : 24),
      candidates_seen: seen,
      leads_added: added,
      email_sources_detected: emailSources,
      error,
    });
    const day = at(ago, 6, 5);
    const usage: [string, string, string | null, number, number | null, number | null, number][] = [
      ["google_geocoding", "geocode", null, 1, null, null, 0.005],
      ["google_places", "text_search", null, Math.max(1, Math.round(seen / 20)), null, null, Math.max(1, Math.round(seen / 20)) * 0.032],
      ["brave_search", "search", null, Math.round(seen / 8) + 1, null, null, (Math.round(seen / 8) + 1) * 0.005],
      ["openai", "extract", "gpt-4o-mini", added + 4, (added + 4) * 3100, (added + 4) * 420, (added + 4) * 0.0007],
    ];
    for (const [provider, operation, model, requests, inTok, outTok, cost] of usage) {
      if (status === "failed" && provider !== "google_geocoding") continue;
      await insert(db, "lead_api_usage", {
        id: randomUUID(),
        tenant_id: T,
        run_id: id,
        provider,
        operation,
        model,
        requests,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_usd: cost.toFixed(6),
        created_at: day,
      });
    }
  }
  // Spend with no run: inbound emails and manual leads.
  for (const ago of [12, 9, 7, 5, 4, 2, 1]) {
    await insert(db, "lead_api_usage", { id: randomUUID(), tenant_id: T, run_id: null, provider: "resend", operation: "receive", model: null, requests: 1, input_tokens: null, output_tokens: null, cost_usd: "0.000400", created_at: at(ago, 10) });
    await insert(db, "lead_api_usage", { id: randomUUID(), tenant_id: T, run_id: null, provider: "openai", operation: "extract", model: "gpt-4o-mini", requests: 1, input_tokens: 5200, output_tokens: 700, cost_usd: "0.001200", created_at: at(ago, 10, 1) });
  }

  // Listing sites
  // name, domain, listingsUrl, source, active, status, statusDetail, lastListingCount, crawledDaysAgo
  const sites: [string, string, string | null, "manual" | "auto_detected", boolean, string, string | null, number, number][] = [
    ["Desert Biz Brokers", "desertbizbrokers.example", "https://desertbizbrokers.example/businesses-for-sale", "auto_detected", true, "ok", null, 14, 1],
    ["AZ Business Market", "azbusinessmarket.example", "https://azbusinessmarket.example/listings", "auto_detected", true, "ok", null, 22, 1],
    ["Pinnacle Business Brokers", "pinnaclebb.example", "https://pinnaclebb.example/buy-a-business", "manual", true, "ok", null, 9, 1],
    ["Southwest Biz Advisors", "swbizadvisors.example", "https://swbizadvisors.example/listings", "manual", true, "ok", null, 6, 2],
    ["Sun Valley Mergers", "sunvalleymergers.example", "https://sunvalleymergers.example/current-listings", "auto_detected", true, "ok", null, 11, 2],
    ["Grand Canyon Business Sales", "gcbusinesssales.example", null, "auto_detected", true, "blocked", "The site's robots.txt asks automated visitors to stay out. The engine does not work around that — open it yourself.", 0, 3],
    ["Saguaro Deal Exchange", "saguarodeals.example", null, "auto_detected", true, "blocked", "The site showed an “are you human?” check instead of its listings.", 0, 3],
    ["Arizona Business Association", "azbizassociation.example", "https://azbizassociation.example/directory", "auto_detected", true, "no_listings", "Read fine, but it is a member directory — no businesses for sale on it.", 0, 4],
    ["Copperline Business Brokers", "copperlinebb.example", "https://copperlinebb.example/listings", "auto_detected", true, "error", "The page timed out twice. It will be retried on the next run.", 0, 1],
    ["Mesa Mergers & Acquisitions", "mesama.example", null, "manual", true, "pending", null, 0, 0],
    ["Old Town Business Sales", "oldtownbizsales.example", null, "auto_detected", false, "pending", null, 0, 12],
  ];
  for (const [name, domain, listingsUrl, source, active, status, detail, count, crawled] of sites) {
    await insert(db, "listing_sites", {
      id: randomUUID(),
      tenant_id: T,
      site_name: name,
      domain,
      site_url: `https://${domain}`,
      listings_url: listingsUrl,
      source,
      active,
      status,
      status_detail: detail,
      last_crawled_at: status === "pending" ? null : at(crawled, 6, 10),
      last_listing_count: count,
      content_hashes: {},
      created_at: at(30),
      updated_at: at(crawled),
    });
  }

  // Email sources
  const emailSources: Row[] = [
    { site_name: "Desert Biz Brokers weekly digest", signup_url: "https://desertbizbrokers.example/alerts", email_field_selector: "input[name=email]", submit_selector: "button[type=submit]", subscribed: true, subscribed_at: at(21), source: "manual", last_attempt_at: at(22), last_attempt_result: "submitted" },
    { site_name: "AZ Business Market alerts", signup_url: "https://azbusinessmarket.example/email-alerts", email_field_selector: "#alert-email", submit_selector: "#alert-go", subscribed: true, subscribed_at: at(14), source: "auto_detected", last_attempt_at: at(15), last_attempt_result: "submitted" },
    { site_name: "Pinnacle Brokers digest", signup_url: "https://pinnaclebb.example/newsletter", email_field_selector: "input[type=email]", submit_selector: "form button", subscribed: true, subscribed_at: at(30), source: "manual", last_attempt_at: at(31), last_attempt_result: "submitted" },
    { site_name: "Sun Valley Mergers new listings", signup_url: "https://sunvalleymergers.example/subscribe", email_field_selector: "input[name=email]", submit_selector: "button.subscribe", subscribed: false, source: "auto_detected", last_attempt_at: at(1), last_attempt_result: "submitted", notes: "Form submitted — waiting for the confirmation email." },
    { site_name: "Grand Canyon Business Sales alerts", signup_url: "https://gcbusinesssales.example/alerts", subscribed: false, captcha_protected: true, source: "auto_detected", last_attempt_at: at(3), last_attempt_result: "captcha", notes: "Has a captcha — sign up by hand with the inbox address, then mark it subscribed." },
    { site_name: "Southwest Biz Advisors private list", signup_url: "https://swbizadvisors.example/private-list", subscribed: false, source: "manual", last_attempt_at: at(5), last_attempt_result: "manual", last_attempt_error: "The form asks you to accept an NDA before you can subscribe.", notes: "Elena offered to add us by hand." },
    { site_name: "Copperline Brokers updates", signup_url: "https://copperlinebb.example/updates", email_field_selector: "input[name=em]", submit_selector: "button#go", subscribed: false, source: "manual", last_attempt_at: at(2), last_attempt_result: "failed", last_attempt_error: "The email field (input[name=em]) wasn't found on the page." },
  ];
  for (const e of emailSources) {
    await insert(db, "email_sources", { id: randomUUID(), tenant_id: T, captcha_protected: false, created_at: at(32), updated_at: at(2), ...e });
  }

  // Invites
  await insert(db, "invites", { id: randomUUID(), tenant_id: T, email: "jordan@tagrholdings.example", role: "member", token_hash: randomBytes(32).toString("hex"), invited_by_user_id: adminId, expires_at: at(-5), last_sent_at: at(2), created_at: at(2) });
  await insert(db, "invites", { id: randomUUID(), tenant_id: T, email: "casey@tagrholdings.example", role: "admin", token_hash: randomBytes(32).toString("hex"), invited_by_user_id: adminId, expires_at: at(3), last_sent_at: at(10), created_at: at(10) });
  await insert(db, "invites", { id: randomUUID(), tenant_id: T, email: "former.intern@example.com", role: "member", token_hash: randomBytes(32).toString("hex"), invited_by_user_id: adminId, expires_at: at(30), revoked_at: at(20), last_sent_at: at(35), created_at: at(35) });

  // Discovered leads (Sourcing)
  type Source = "broker_listings" | "google_places" | "marketplace_scrape" | "brave_search" | "manual_assist";
  interface Lead {
    source: Source;
    name: string;
    industry: string;
    city: string;
    state: string;
    ask?: number;
    rev?: number;
    profit?: number;
    employees?: number;
    years?: number;
    reason?: string;
    match?: "local" | "region" | "state" | "unknown" | "outside";
    signals?: string[];
    status?: "new" | "processed" | "dismissed";
    ago: number;
    profile?: string;
    promotedTo?: string;
    contact?: { name?: string; email?: string; phone?: string };
    website?: string;
    note?: string;
  }
  const leads: Lead[] = [
    { source: "broker_listings", name: "Established Phoenix HVAC Company — 24 yrs", industry: "HVAC", city: "Phoenix", state: "AZ", ask: 2_650_000, rev: 2_400_000, profit: 610_000, employees: 14, years: 24, reason: "Owner retiring", match: "local", signals: ["retiring"], ago: 2, profile: "hvac" },
    { source: "broker_listings", name: "Residential HVAC & Heating — Scottsdale", industry: "HVAC", city: "Scottsdale", state: "AZ", ask: 3_100_000, rev: 3_400_000, profit: 720_000, employees: 19, years: 17, match: "local", ago: 2, profile: "hvac" },
    { source: "broker_listings", name: "Commercial HVAC Service Contracts — Tempe", industry: "HVAC", city: "Tempe", state: "AZ", ask: 1_850_000, rev: 1_700_000, profit: 410_000, employees: 9, years: 12, reason: "Owner selling — relocating", match: "local", signals: ["owner selling"], ago: 3, profile: "hvac" },
    { source: "broker_listings", name: "Turnkey Air Conditioning Business — Chandler", industry: "HVAC", city: "Chandler", state: "AZ", ask: 4_200_000, rev: 3_900_000, profit: 880_000, employees: 22, years: 21, match: "local", ago: 3, profile: "hvac" },
    { source: "broker_listings", name: "HVAC Installer, Repeat Customers — Glendale", industry: "HVAC", city: "Glendale", state: "AZ", ask: 980_000, rev: 1_250_000, profit: 260_000, employees: 7, years: 9, match: "local", ago: 4, profile: "hvac" },
    { source: "broker_listings", name: "Heating & Cooling, 3 Service Vans — Mesa", industry: "HVAC", city: "Mesa", state: "AZ", ask: 725_000, rev: 880_000, profit: 190_000, employees: 5, years: 8, match: "local", ago: 4, profile: "hvac" },
    { source: "broker_listings", name: "Profitable HVAC Business, Absentee Owner — Peoria", industry: "HVAC", city: "Peoria", state: "AZ", ask: 2_200_000, rev: 2_050_000, profit: 540_000, employees: 12, years: 15, match: "local", ago: 5, profile: "hvac" },
    { source: "broker_listings", name: "Tucson HVAC & Refrigeration Company", industry: "HVAC", city: "Tucson", state: "AZ", ask: 1_400_000, rev: 1_600_000, profit: 330_000, employees: 10, years: 19, match: "state", ago: 5, profile: "hvac" },
    { source: "broker_listings", name: "Flagstaff Mountain Heating Co.", industry: "HVAC", city: "Flagstaff", state: "AZ", ask: 860_000, rev: 950_000, profit: 205_000, employees: 6, years: 14, match: "region", ago: 6, profile: "hvac" },
    { source: "broker_listings", name: "Las Vegas Air & Heat Service", industry: "HVAC", city: "Las Vegas", state: "NV", ask: 1_950_000, rev: 2_100_000, profit: 450_000, employees: 11, years: 13, match: "outside", ago: 6, profile: "hvac" },
    { source: "broker_listings", name: "HVAC Franchise Territory — East Valley", industry: "HVAC", city: "Gilbert", state: "AZ", ask: 5_800_000, rev: 5_200_000, profit: 1_100_000, employees: 30, years: 11, match: "local", ago: 7, profile: "hvac" },
    { source: "broker_listings", name: "Small HVAC Shop, Great Reviews — Surprise", industry: "HVAC", city: "Surprise", state: "AZ", ask: 320_000, rev: 410_000, profit: 95_000, employees: 3, years: 6, match: "local", ago: 8, profile: "hvac" },
    { source: "broker_listings", name: "HVAC Company — Details on Request", industry: "HVAC", city: "Phoenix", state: "AZ", match: "unknown", ago: 9, profile: "hvac" },
    { source: "broker_listings", name: "Maricopa Heating & Air, 18 Years", industry: "HVAC", city: "Maricopa", state: "AZ", ask: 1_150_000, rev: 1_320_000, profit: 280_000, employees: 8, years: 18, reason: "Owner retiring", match: "local", signals: ["retiring"], ago: 10, profile: "hvac" },
    { source: "google_places", name: "Rapid Rooter Drain Service", industry: "Plumbing", city: "Mesa", state: "AZ", ago: 1, profile: "plumbing", contact: { phone: "(480) 555-0199" }, website: "https://rapidrooter.example" },
    { source: "google_places", name: "Sunrise Plumbing & Rooter", industry: "Plumbing", city: "Mesa", state: "AZ", ago: 1, profile: "plumbing", contact: { phone: "(480) 555-0121" }, website: "https://sunriseplumbing.example" },
    { source: "google_places", name: "Superstition Plumbing", industry: "Plumbing", city: "Apache Junction", state: "AZ", ago: 1, profile: "plumbing", contact: { phone: "(480) 555-0167" } },
    { source: "google_places", name: "Red Mountain Plumbers", industry: "Plumbing", city: "Mesa", state: "AZ", ago: 2, profile: "plumbing", contact: { phone: "(480) 555-0133" }, website: "https://redmountainplumbers.example" },
    { source: "google_places", name: "Gilbert Drain & Sewer", industry: "Plumbing", city: "Gilbert", state: "AZ", ago: 2, profile: "plumbing", contact: { phone: "(480) 555-0158" } },
    { source: "google_places", name: "Hohokam Plumbing Services", industry: "Plumbing", city: "Chandler", state: "AZ", ago: 3, profile: "plumbing", contact: { phone: "(480) 555-0102" }, website: "https://hohokamplumbing.example" },
    { source: "google_places", name: "East Valley Water Heaters", industry: "Plumbing", city: "Queen Creek", state: "AZ", ago: 3, profile: "plumbing" },
    { source: "google_places", name: "Lone Butte Plumbing", industry: "Plumbing", city: "Mesa", state: "AZ", ago: 4, profile: "plumbing", contact: { phone: "(480) 555-0176" } },
    { source: "marketplace_scrape", name: "Pest Control Route — 1,200 Customers", industry: "Pest control", city: "Gilbert", state: "AZ", ask: 640_000, rev: 520_000, profit: 180_000, employees: 4, years: 10, ago: 18, profile: "pest" },
    { source: "marketplace_scrape", name: "Termite & Pest, Recurring Revenue", industry: "Pest control", city: "Mesa", state: "AZ", ask: 910_000, rev: 780_000, profit: 245_000, employees: 6, years: 14, ago: 18, profile: "pest" },
    { source: "marketplace_scrape", name: "Lawn & Pest Combo Business", industry: "Pest control", city: "Chandler", state: "AZ", ask: 450_000, rev: 610_000, profit: 120_000, employees: 5, years: 7, ago: 19, profile: "pest" },
    { source: "brave_search", name: "Cactus Air Conditioning (company site)", industry: "HVAC", city: "Phoenix", state: "AZ", ago: 7, profile: "hvac", website: "https://cactusair.example" },
    { source: "brave_search", name: "Palo Verde Mechanical", industry: "HVAC", city: "Avondale", state: "AZ", ago: 7, profile: "hvac", website: "https://paloverdemech.example" },
    { source: "manual_assist", name: "Tempe Appliance Repair", industry: "Appliance repair", city: "Tempe", state: "AZ", ask: 380_000, rev: 520_000, ago: 6, note: "Rachel mentioned this on a call — check it out.", contact: { name: "Rachel Kim", email: "rachel@pinnaclebb.example" } },
    { source: "manual_assist", name: "Phoenix Pool Service Route", industry: "Pool service", city: "Phoenix", state: "AZ", ask: 290_000, rev: 360_000, ago: 4, note: "Saw this on a Facebook group." },
    // Promoted to the pipeline (status processed, linked to a Leads item)
    { source: "broker_listings", name: "Cool Air Mechanical — HVAC (Phoenix)", industry: "HVAC", city: "Phoenix", state: "AZ", ask: 2_650_000, rev: 2_400_000, profit: 610_000, employees: 14, years: 22, reason: "Owner retiring", match: "local", signals: ["retiring"], status: "processed", ago: 31, profile: "hvac", promotedTo: "Cool Air Mechanical — HVAC (Phoenix)" },
    { source: "broker_listings", name: "Desert Breeze Heating & Air", industry: "HVAC", city: "Phoenix", state: "AZ", ask: 3_100_000, rev: 3_300_000, profit: 700_000, employees: 18, years: 16, match: "local", status: "processed", ago: 26, profile: "hvac", promotedTo: "Desert Breeze Heating & Air" },
    { source: "broker_listings", name: "Camelback HVAC", industry: "HVAC", city: "Phoenix", state: "AZ", ask: 1_950_000, rev: 2_000_000, profit: 450_000, employees: 11, years: 13, match: "local", status: "processed", ago: 21, profile: "hvac", promotedTo: "Camelback HVAC" },
    { source: "google_places", name: "Sonoran Plumbing Co.", industry: "Plumbing", city: "Mesa", state: "AZ", status: "processed", ago: 19, profile: "plumbing", promotedTo: "Sonoran Plumbing Co.", contact: { phone: "(480) 555-0188" } },
    { source: "google_places", name: "Valley Pest Solutions", industry: "Pest control", city: "Glendale", state: "AZ", status: "processed", ago: 12, profile: "pest", promotedTo: "Valley Pest Solutions", contact: { phone: "(623) 555-0102" } },
    // Dismissed
    { source: "broker_listings", name: "HVAC Distributor (not a service business)", industry: "HVAC", city: "Phoenix", state: "AZ", ask: 7_400_000, rev: 9_100_000, profit: 1_400_000, employees: 48, years: 30, match: "local", status: "dismissed", ago: 12, profile: "hvac" },
    { source: "broker_listings", name: "Mobile Home Park HVAC Contract", industry: "HVAC", city: "Apache Junction", state: "AZ", ask: 250_000, rev: 310_000, profit: 40_000, employees: 2, years: 4, match: "local", status: "dismissed", ago: 14, profile: "hvac" },
    { source: "google_places", name: "Discount Drain Cleaning", industry: "Plumbing", city: "Mesa", state: "AZ", status: "dismissed", ago: 9, profile: "plumbing" },
    { source: "marketplace_scrape", name: "Pest Control Franchise Resale", industry: "Pest control", city: "Scottsdale", state: "AZ", ask: 1_700_000, rev: 940_000, profit: 150_000, employees: 9, years: 6, status: "dismissed", ago: 17, profile: "pest" },
    { source: "brave_search", name: "AAA Cooling Supply House", industry: "HVAC", city: "Phoenix", state: "AZ", status: "dismissed", ago: 10, profile: "hvac", website: "https://aaacoolingsupply.example" },
  ];
  const usedKeys = new Set<string>();
  for (const [i, l] of leads.entries()) {
    const f: Record<string, unknown> = {
      businessName: l.name,
      industry: l.industry,
      summary: `${l.industry} business in ${l.city}, ${l.state}${l.years ? `, operating ${l.years} years` : ""}${l.reason ? `. ${l.reason}.` : "."}`,
      location: { city: l.city, state: l.state, address: null },
      website: l.website ?? null,
      contact: l.contact ? { name: l.contact.name ?? null, email: l.contact.email ?? null, phone: l.contact.phone ?? null } : null,
      estimatedRevenue: l.rev ? usd(l.rev) : null,
      askingPrice: l.ask ? usd(l.ask) : null,
      estimatedRevenueUsd: l.rev ?? null,
      annualProfitUsd: l.profit ?? null,
      askingPriceUsd: l.ask ?? null,
      employeesCount: l.employees ?? null,
      yearsInBusinessCount: l.years ?? null,
      employees: l.employees ? String(l.employees) : null,
      yearsInBusiness: l.years ? String(l.years) : null,
      reasonForSelling: l.reason ?? null,
      locationMatch: l.match ?? null,
      matchedSignals: l.signals ?? null,
      note: l.note ?? null,
    };
    let key = `${l.source}:${l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    while (usedKeys.has(key)) key += "-2";
    usedKeys.add(key);
    await insert(db, "raw_leads", {
      id: randomUUID(),
      tenant_id: T,
      search_profile_id: l.profile ? profileId[l.profile] : null,
      source_type: l.source,
      source_url: l.website ?? (l.source === "broker_listings" ? `https://desertbizbrokers.example/listing/${i + 100}` : l.source === "marketplace_scrape" ? `https://azbusinessmarket.example/listing/${i + 300}` : null),
      business_name: l.name,
      raw_text: `${l.name}\n${f.summary}\n${l.ask ? `Asking price ${usd(l.ask)}.` : ""} ${l.rev ? `Revenue ${usd(l.rev)}.` : ""}`.trim(),
      extracted_fields: f,
      status: l.status ?? "new",
      dedupe_key: key,
      pipeline_item_id: l.promotedTo ? itemId[l.promotedTo] : null,
      created_at: at(l.ago, 7, i % 50),
      updated_at: at(Math.max(0, l.ago - (l.status === "new" || !l.status ? 0 : 1)), 8),
    });
  }

  // Emails received (Settings → Inbox). Each listing is a raw lead of source email_digest; an email with no listing is one fallback lead.
  interface Mail {
    id: string;
    from: string;
    subject: string;
    ago: number;
    listings: { name: string; industry: string; city: string; state: string; ask?: number; rev?: number; status?: "new" | "processed" | "dismissed"; summary?: string }[];
    fallback?: "nothing" | "failed";
  }
  const mails: Mail[] = [
    {
      id: "re_8f2a91c3d4", from: "Desert Biz Brokers <alerts@desertbizbrokers.example>", subject: "Weekly listings — 3 new businesses in Arizona", ago: 1,
      listings: [
        { name: "Plumbing & Heating Company — Scottsdale", industry: "Plumbing", city: "Scottsdale", state: "AZ", ask: 1_300_000, rev: 1_650_000 },
        { name: "Garage Door Installation & Repair — Phoenix", industry: "Garage doors", city: "Phoenix", state: "AZ", ask: 780_000, rev: 910_000 },
        { name: "Landscape Maintenance, 140 Contracts — Mesa", industry: "Landscaping", city: "Mesa", state: "AZ", ask: 520_000, rev: 700_000, status: "dismissed" },
      ],
    },
    {
      id: "re_17b0e6aa52", from: "Rachel Kim <rachel@pinnaclebb.example>", subject: "New: retiring owner, HVAC company, West Valley", ago: 2,
      listings: [{ name: "West Valley HVAC — Retiring Owner", industry: "HVAC", city: "Glendale", state: "AZ", ask: 2_050_000, rev: 2_250_000 }],
    },
    {
      id: "re_c4d9033e7b", from: "Pinnacle Brokers Digest <digest@pinnaclebb.example>", subject: "Your Pinnacle digest: 4 listings that match your buy box", ago: 4,
      listings: [
        { name: "Commercial Roofing Contractor — Phoenix", industry: "Roofing", city: "Phoenix", state: "AZ", ask: 2_800_000, rev: 3_200_000 },
        { name: "Electrical Contractor, Union Shop — Tucson", industry: "Electrical", city: "Tucson", state: "AZ", ask: 1_100_000, rev: 1_900_000 },
        { name: "Fire Sprinkler Inspection Company — Tempe", industry: "Fire protection", city: "Tempe", state: "AZ", ask: 960_000, rev: 1_150_000, status: "processed" },
        { name: "Janitorial Services, 40 Accounts — Gilbert", industry: "Janitorial", city: "Gilbert", state: "AZ", ask: 410_000, rev: 640_000 },
      ],
    },
    {
      id: "re_5e71aa08f1", from: "Southwest Biz Advisors <elena@swbizadvisors.example>", subject: "Plumbing route for sale — Chandler (off-market)", ago: 6,
      listings: [{ name: "Off-Market Plumbing Route — Chandler", industry: "Plumbing", city: "Chandler", state: "AZ", ask: 690_000, rev: 810_000 }],
    },
    { id: "re_90a3b2d6e4", from: "AZ Business Market <no-reply@azbusinessmarket.example>", subject: "Welcome! Your alerts are confirmed", ago: 14, listings: [], fallback: "nothing" },
    { id: "re_2c68f0b19a", from: "Carlos Medina <carlos.medina@example.com>", subject: "Fwd: possible deal — scanned flyer", ago: 3, listings: [], fallback: "failed" },
  ];
  for (const [mi, m] of mails.entries()) {
    const head = `From: ${m.from}\nSubject: ${m.subject}\n\n`;
    if (m.fallback) {
      await insert(db, "raw_leads", {
        id: randomUUID(),
        tenant_id: T,
        search_profile_id: null,
        source_type: "email_digest",
        source_url: null,
        business_name: m.subject,
        raw_text: `${head}${m.fallback === "nothing" ? "Thanks for subscribing to listing alerts. You will receive new listings as they are posted." : "(attachment: flyer.pdf — scanned image, no text)"}`,
        extracted_fields: {
          summary: m.fallback === "nothing" ? "No business for sale was recognised in this email." : "The automatic reading of this email failed — open it and add the details by hand.",
          listingSignature: null,
        },
        status: m.fallback === "nothing" ? "dismissed" : "new",
        dedupe_key: `email:${m.id}`,
        created_at: at(m.ago, 10, mi),
        updated_at: at(m.ago, 10, mi),
      });
      continue;
    }
    for (const [li, l] of m.listings.entries()) {
      await insert(db, "raw_leads", {
        id: randomUUID(),
        tenant_id: T,
        search_profile_id: null,
        source_type: "email_digest",
        source_url: `https://${m.from.match(/@([^>]+)/)?.[1] ?? "example.com"}/listing/${m.id.slice(3, 9)}-${li}`,
        business_name: l.name,
        raw_text: `${head}${l.name}\nAsking price ${l.ask ? usd(l.ask) : "n/a"}. Revenue ${l.rev ? usd(l.rev) : "n/a"}.\nLocation: ${l.city}, ${l.state}.`,
        extracted_fields: {
          businessName: l.name,
          industry: l.industry,
          summary: `${l.industry} business for sale in ${l.city}, ${l.state}.`,
          location: { city: l.city, state: l.state, address: null },
          askingPrice: l.ask ? usd(l.ask) : null,
          estimatedRevenue: l.rev ? usd(l.rev) : null,
          askingPriceUsd: l.ask ?? null,
          estimatedRevenueUsd: l.rev ?? null,
          listingSignature: randomBytes(12).toString("hex"),
        },
        status: l.status ?? "new",
        dedupe_key: `email:${m.id}:${li}`,
        created_at: at(m.ago, 10, mi * 3 + li),
        updated_at: at(m.ago, 10, mi * 3 + li),
      });
    }
  }
}

// ───────────────────────────── Menlo CRE (small) ─────────────────────────────

async function seedMenloCre({ db, tenantId: T, adminId }: Ctx) {
  const orgs = ["Palm Court Plaza LLC", "Westgate Industrial Partners", "Camelback Office Holdings"];
  const orgId: Record<string, string> = {};
  for (const [i, name] of orgs.entries()) {
    orgId[name] = randomUUID();
    await insert(db, "organizations", { id: orgId[name], tenant_id: T, name, website: null, notes: null, created_at: at(20 - i), updated_at: at(20 - i) });
  }
  const people: [string, string, string, string][] = [
    ["Nina Alvarez", "Palm Court Plaza LLC", "nina@palmcourt.example", "(602) 555-0210"],
    ["Brent Hollis", "Westgate Industrial Partners", "brent@westgateip.example", "(623) 555-0211"],
    ["Yara Haddad", "Camelback Office Holdings", "yara@camelbackoffice.example", "(480) 555-0212"],
  ];
  const contactId: Record<string, string> = {};
  for (const [name, org, email, phone] of people) {
    contactId[name] = randomUUID();
    await insert(db, "contacts", { id: contactId[name], tenant_id: T, organization_id: orgId[org], name, email, phone, created_at: at(18), updated_at: at(18) });
  }
  const board = randomUUID();
  await insert(db, "pipeline_boards", { id: board, tenant_id: T, name: DEFAULT_BOARD_NAME, columns: DEFAULT_BOARD_COLUMNS, is_system: true, created_at: at(20) });
  const items: [string, string, string, string][] = [
    ["Palm Court retail strip — 24,000 sf", "in_discussion", "Palm Court Plaza LLC", "Nina Alvarez"],
    ["Westgate flex industrial, 3 buildings", "outreach", "Westgate Industrial Partners", "Brent Hollis"],
    ["Camelback office condo portfolio", "sourced", "Camelback Office Holdings", "Yara Haddad"],
    ["Chandler medical office", "diligence", "", ""],
  ];
  const itemId: string[] = [];
  for (const [i, [title, stage, org, contact]] of items.entries()) {
    const id = randomUUID();
    itemId.push(id);
    await insert(db, "pipeline_items", { id, tenant_id: T, board_id: board, title, stage, contact_id: contact ? contactId[contact] : null, organization_id: org ? orgId[org] : null, notes: null, created_at: at(14 - i), updated_at: at(10 - i) });
  }
  await insert(db, "activities", { id: randomUUID(), tenant_id: T, type: "meeting", subject: "Tour Palm Court with Nina", due_date: at(-2, 10), done: false, priority: "high", notes: null, contact_id: contactId["Nina Alvarez"], organization_id: orgId["Palm Court Plaza LLC"], pipeline_item_id: itemId[0], assigned_to_user_id: adminId, created_by_user_id: adminId, notify: true, created_at: at(3), updated_at: at(3) });
  await insert(db, "activities", { id: randomUUID(), tenant_id: T, type: "task", subject: "Pull comps for Westgate", due_date: at(0, 16), done: false, priority: "medium", notes: null, contact_id: null, organization_id: null, pipeline_item_id: itemId[1], assigned_to_user_id: null, created_by_user_id: adminId, notify: false, created_at: at(2), updated_at: at(2) });

  const profile = randomUUID();
  await insert(db, "search_profiles", {
    id: profile, tenant_id: T, name: "Retail strip centers — Phoenix", category: "Retail centers", keywords: ["strip center", "shopping center"], city: "Phoenix", state: "AZ", radius_miles: 30, location_scope: "state",
    sources: { google_places: true, brave_search: true, broker_listings: false, company_site_scrape: false, marketplace_scrape: false }, max_leads_per_run: 25, frequency_hours: 48, criteria: null, active: true, last_run_at: at(1), created_at: at(15), updated_at: at(2),
  });
  const leads: [string, string, string, number][] = [
    ["Desert Ridge Marketplace outparcel", "Phoenix", "AZ", 2], ["Arcadia Square retail", "Phoenix", "AZ", 2], ["Tempe Market Center", "Tempe", "AZ", 3],
    ["Glendale Crossroads strip", "Glendale", "AZ", 4], ["Mesa Plaza storefronts", "Mesa", "AZ", 5], ["Scottsdale Road retail pad", "Scottsdale", "AZ", 6],
  ];
  for (const [i, [name, city, state, ago]] of leads.entries()) {
    await insert(db, "raw_leads", {
      id: randomUUID(), tenant_id: T, search_profile_id: profile, source_type: "google_places", source_url: null, business_name: name, raw_text: name,
      extracted_fields: { businessName: name, industry: "Retail", location: { city, state, address: null }, summary: `Retail property in ${city}, ${state}.` }, status: "new", dedupe_key: `google_places:cre-${i}`, created_at: at(ago), updated_at: at(ago),
    });
  }
}

// ───────────────────────────── Main ─────────────────────────────

async function main() {
  const pool = new Pool({ connectionString });
  const db = await pool.connect();
  try {
    const existing = (await db.query(`select count(*)::int as n from public.tenants`)).rows[0].n;
    if (existing > 0) throw new Error(`${host} already has ${existing} workspace(s). Wipe it first (scripts/wipe-keep-super-admin.ts).`);
    const admin = await db.query<{ user_id: string; email: string }>(
      `select r.user_id, u.email from public.platform_roles r join neon_auth."user" u on u.id::text = r.user_id limit 1`
    );
    if (admin.rows.length === 0) throw new Error("No super admin on this database to make a member of the demo workspaces.");
    const adminId = admin.rows[0].user_id;
    console.log(`Seeding ${host} — super admin ${admin.rows[0].email}`);

    await db.query("begin");
    try {
      const workspaces: { name: string; slug: string; id: string; buyer?: [string, string, string]; seed?: (ctx: Ctx) => Promise<void> }[] = [
        { name: "Tagr Holdings", slug: "tagr-holdings", id: TAGR_TENANT_ID, buyer: ["Alex Morgan", "(480) 555-0142", "Tagr Holdings"], seed: seedTagr },
        { name: "Menlo CRE", slug: "menlo-cre", id: randomUUID(), buyer: ["Jordan Ellis", "(602) 555-0100", "Menlo CRE"], seed: seedMenloCre },
        { name: "Menlo Dental Transitions", slug: "menlo-dental", id: randomUUID() },
      ];
      for (const w of workspaces) {
        await insert(db, "tenants", tenantRow(w.name, w.slug, w.id, w.buyer));
        await insert(db, "tenant_members", { id: randomUUID(), tenant_id: w.id, user_id: adminId, role: "admin", created_at: at(40) });
        if (w.seed) await w.seed({ db, tenantId: w.id, adminId });
        console.log(`  ✓ ${w.name}${w.seed ? "" : " (empty)"}`);
      }
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }

    for (const t of ["organizations", "contacts", "pipeline_boards", "pipeline_items", "activities", "raw_leads", "search_profiles", "lead_runs", "lead_api_usage", "listing_sites", "email_sources", "invites"]) {
      console.log(`  ${t}: ${(await db.query(`select count(*)::int as n from public.${t}`)).rows[0].n}`);
    }
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
