import { verifyAccessToken } from "@/lib/access";
import { OperatingPlaybook } from "@/components/portal/operating-playbook";
import { AccessRequestForm } from "@/components/portal/access-request-form";

function PortalFallback() {
  return <AccessRequestForm />;
}

export default function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  return <PortalContent searchParams={searchParams} />;
}

async function PortalContent({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token || "";
  const hasAccess = verifyAccessToken(token);

  if (!hasAccess) {
    return <PortalFallback />;
  }

  return <OperatingPlaybook />;
}
