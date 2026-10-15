import { getWorkspace } from "@/lib/auth-server";
import { workspacePath } from "@/lib/workspace-path";
import { HubPage } from "@/components/layout/HubPage";
import { initialsFor } from "@/lib/utils";
import { PRESENTATION_HTML } from "./presentation-html";

export const dynamic = "force-dynamic";

/**
 * The platform tour — a short, interactive presentation of the whole CRM, for someone who'd rather not read the
 * full documentation. It's a self-contained page (content/presentation/index.html) shown in a frame, so its own
 * layout, keyboard navigation and phone reading mode work untouched. Behind the login like everything else: it
 * carries real portfolio numbers.
 */
export default async function PresentationPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspace(slug);

  return (
    <HubPage
      fitViewport
      user={{ name: user.name || user.email, initials: initialsFor(user.name || user.email) }}
      kicker="Documentation"
      title="Platform tour"
      backHref={workspacePath(slug, "/docs")}
    >
      <iframe
        data-tour="presentation-frame"
        title="TAGR CRM platform tour"
        srcDoc={PRESENTATION_HTML}
        allow="fullscreen"
        allowFullScreen
        className="h-[calc(100dvh-10rem)] w-full rounded-lg border border-divider bg-background md:h-auto md:min-h-0 md:flex-1"
      />
    </HubPage>
  );
}
