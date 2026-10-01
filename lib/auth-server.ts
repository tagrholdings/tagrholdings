import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { tenancyService } from "@/modules/tenancy/tenancy.service";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});

/**
 * The signed-in user, nothing more — for pages outside any workspace (sign-in, the workspace picker, the resolver at
 * `/home`). Redirects to sign-in when unauthenticated. Callers must set `export const dynamic = "force-dynamic"` —
 * auth.getSession() reads request cookies and can't be statically rendered.
 *
 * Wrapped in React's `cache()` so a layout and its page can both call it and pay for one session lookup per request —
 * request-scoped de-duplication, not a Next.js cross-request cache.
 */
export const getCurrentUser = cache(async () => {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  return session.user;
});

/**
 * The signed-in user inside ONE workspace (`/w/<slug>/…`): checks the session AND that the person may open that
 * workspace (a member, or a super admin), and answers 404 otherwise — never "forbidden", so a slug's existence isn't
 * revealed. Every page under `app/(hub)/w/[workspace]` calls this with its own `params.workspace` — a layout's check
 * doesn't protect the pages beneath it, since they can render on their own.
 *
 * `user.tenantId` is kept on the user object so the existing `user.tenantId` call sites keep reading the same way; the
 * workspace's own fields (slug, name, role, isSuperAdmin) sit beside it. Request-scoped `cache()` as above, keyed by
 * slug, so the layout and the page share one lookup.
 */
export const getWorkspace = cache(async (slug: string) => {
  const user = await getCurrentUser();
  const access = await tenancyService.resolveAccess(user.id, slug);
  if (!access) notFound();
  return { ...access, user: { ...user, tenantId: access.tenantId } };
});
