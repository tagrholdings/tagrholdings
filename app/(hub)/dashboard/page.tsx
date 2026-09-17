import { getCurrentUser } from "@/lib/auth-server";

// getCurrentUser() reads request cookies via auth.getSession() — can't be
// statically rendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <main>
      <h1>Tagr CRM</h1>
      <p>Signed in as {user.email}. The real dashboard lands in checklist item 4.</p>
    </main>
  );
}
