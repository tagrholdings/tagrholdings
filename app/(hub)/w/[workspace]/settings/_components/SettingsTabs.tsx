"use client";

import { LinkTabs } from "@/components/shared/link-tabs";
import { useWorkspace } from "@/components/layout/workspace-context";

/** `adminOnly` tabs are hidden from plain members (their pages answer 404 too — hiding is only the courtesy). */
const TABS = [
  { id: "notifications", label: "Notifications", href: "/settings/notifications" },
  { id: "inbox", label: "Inbox", href: "/settings/inbox" },
  { id: "members", label: "Members", href: "/settings/members", adminOnly: true },
  { id: "invites", label: "Invites", href: "/settings/invites", adminOnly: true },
  { id: "workspace", label: "Workspace", href: "/settings/workspace", adminOnly: true },
  { id: "application", label: "Application", href: "/settings/application" },
  { id: "engine-spend", label: "Engine spend", href: "/settings/engine-spend", adminOnly: true },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];

export function SettingsTabs({ active }: { active: SettingsTab }) {
  const { role } = useWorkspace();
  const tabs = TABS.filter((tab) => !("adminOnly" in tab) || role === "admin");
  return <LinkTabs label="Settings" tabs={tabs} active={active} tourId="settings-tabs" />;
}
