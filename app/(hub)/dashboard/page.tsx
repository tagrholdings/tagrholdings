import { getCurrentUser } from "@/lib/auth-server";
import { AppShell } from "@/components/layout/AppShell";
import { initialsFor } from "@/lib/utils";

// getCurrentUser() reads request cookies via auth.getSession() — can't be
// statically rendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <AppShell
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Overview"
      title="Dashboard"
    >
      <div className="rounded-lg border border-divider bg-surface p-6">
        <p className="text-sm text-muted-foreground">
          The real dashboard content lands in checklist item 4 — this confirms the hub shell
          (auth, Sidebar/BottomNav/AppHeader, sign-out) is wired end to end.
        </p>
      </div>
    </AppShell>
  );
}
