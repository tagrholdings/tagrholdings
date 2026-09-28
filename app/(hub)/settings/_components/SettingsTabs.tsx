import { LinkTabs } from "@/components/shared/link-tabs";

const TABS = [
  { id: "notifications", label: "Notifications", href: "/settings/notifications" },
  { id: "invites", label: "Invites", href: "/settings/invites" },
  { id: "application", label: "Application", href: "/settings/application" },
  { id: "engine-spend", label: "Engine spend", href: "/settings/engine-spend" },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];

export function SettingsTabs({ active }: { active: SettingsTab }) {
  return <LinkTabs label="Settings" tabs={TABS} active={active} />;
}
