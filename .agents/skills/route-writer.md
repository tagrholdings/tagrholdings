# Skill: External Boundaries Writer

Use this skill whenever the request involves a Route Handler (`app/api/.../route.ts`) that talks to the outside world: webhooks, callbacks from third-party services (Resend, auth providers), or any endpoint that isn't called by the app's own UI via a Server Action.

## When to use a Route Handler instead of a Server Action

- **Server Action**: any mutation triggered by the CRM's own UI (a logged-in user clicking something).
- **Route Handler**: any request coming from outside the app — a Resend email-delivery-status webhook, an OAuth callback, an endpoint an external service calls asynchronously.

The scraping job does **not** call a Route Handler in this app — it writes directly to the database (see `.agents/docs/LEAD_INGESTION.md`). Route Handlers here exist for integrations that need a real HTTP endpoint (webhooks), not to replace communication via the shared database.

## Structure (example: Resend webhook events)

```ts
// app/api/webhooks/resend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { activitiesService } from "@/modules/activities/activities.service";
import { verifyResendSignature } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const isValid = verifyResendSignature(req.headers, rawBody);
  if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = JSON.parse(rawBody);
  // Route Handler stays thin — delegates to the right domain's Service
  await activitiesService.recordEmailEvent(event);

  return NextResponse.json({ received: true });
}
```

## Rules

- Every external webhook verifies a signature/secret before processing anything — never trust the payload just because it arrived at the right endpoint.
- A Route Handler is as thin as a Server Action: validate the request, extract the relevant data, delegate to the right Service. Business logic doesn't live here.
- A Route Handler that needs to know which tenant an event belongs to resolves that from an identifier present in the payload (e.g. a metadata id that was already recorded with `tenantId` at the time the original message was sent), never by trusting something freely supplied by the external service without cross-checking an existing database record.
