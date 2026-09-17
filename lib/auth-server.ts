import "server-only";
import { redirect } from "next/navigation";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});

/**
 * Redirects to sign-in when unauthenticated. Callers (page.tsx) must set
 * `export const dynamic = "force-dynamic"` — auth.getSession() reads request
 * cookies and can't be statically rendered.
 *
 * `tenantId` doesn't live on the Neon Auth user (managed Better Auth doesn't
 * expose `additionalFields`) — it's resolved via `tenant_members` instead.
 * Throws if the signed-in user has no tenant link yet.
 */
export async function getCurrentUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  const tenantId = await tenancyService.getTenantIdForUser(session.user.id);
  return { ...session.user, tenantId };
}
