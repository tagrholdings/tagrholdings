import { redirect } from "next/navigation";

/** Settings is a set of tabs; the avatar menu links here, so land on the first one. */
export default function SettingsPage() {
  redirect("/settings/notifications");
}
