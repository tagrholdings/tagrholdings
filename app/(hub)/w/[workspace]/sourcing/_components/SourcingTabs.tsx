import { LinkTabs } from "@/components/shared/link-tabs";

const TABS = [
  { id: "review", label: "Review", href: "/sourcing" },
  { id: "emails", label: "Emails", href: "/sourcing/emails" },
  { id: "profiles", label: "Search profiles", href: "/sourcing/profiles" },
  { id: "listing-sites", label: "Listing sites", href: "/sourcing/listing-sites" },
  { id: "email-sources", label: "Email sources", href: "/sourcing/email-sources" },
] as const;

export type SourcingTab = (typeof TABS)[number]["id"];

/** Sub-navigation for Sourcing — where deals are found before they become leads. See LinkTabs. */
export function SourcingTabs({ active }: { active: SourcingTab }) {
  return <LinkTabs label="Sourcing" tabs={TABS} active={active} tourId="sourcing-tabs" mobileSticky />;
}
