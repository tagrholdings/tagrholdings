/**
 * The CRM's public origin, for links that go out in emails. `CRM_URL` overrides it (a staging deploy); otherwise
 * production uses the real CRM host and local dev uses localhost. Deliberately not SITE_URL, which is the
 * marketing site (www.tagrholdings.com).
 */
export function crmUrl(): string {
  const configured = process.env.CRM_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "https://crm.tagrholdings.com" : "http://localhost:3000";
}
