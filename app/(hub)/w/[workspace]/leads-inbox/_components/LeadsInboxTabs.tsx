import { LinkTabs } from "@/components/shared/link-tabs";

const TABS = [
  { id: "inbox", label: "Inbox", href: "/leads-inbox" },
  { id: "profiles", label: "Search profiles", href: "/leads-inbox/profiles" },
  { id: "listing-sites", label: "Listing sites", href: "/leads-inbox/listing-sites" },
  { id: "email-sources", label: "Email sources", href: "/leads-inbox/email-sources" },
] as const;

export type LeadsInboxTab = (typeof TABS)[number]["id"];

/** Sub-navigation for the lead engine's screens — see LinkTabs. */
export function LeadsInboxTabs({ active }: { active: LeadsInboxTab }) {
  return <LinkTabs label="Lead engine" tabs={TABS} active={active} tourId="leads-inbox-tabs" mobileSticky />;
}
