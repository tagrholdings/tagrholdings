import { getWorkspace } from "@/lib/auth-server";
import { HubPage } from "@/components/layout/HubPage";
import { profileService } from "@/modules/profile/profile.service";
import { initialsFor } from "@/lib/utils";
import { ProfileView } from "./_components/ProfileView";

export const dynamic = "force-dynamic";

/** The signed-in person's own profile: display name and email (editable), and their role and title in each workspace. */
export default async function ProfilePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user, isSuperAdmin } = await getWorkspace(slug);
  const workspaces = await profileService.getWorkspaces(user.id);

  return (
    <HubPage user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }} kicker="Account" title="Profile">
      <ProfileView name={user.name ?? ""} email={user.email} workspaces={workspaces} currentSlug={slug} isSuperAdmin={isSuperAdmin} />
    </HubPage>
  );
}
