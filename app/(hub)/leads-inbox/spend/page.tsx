import { redirect } from "next/navigation";

/** Engine spend moved to Settings — keeps old links and bookmarks working. */
export default function EngineSpendRedirect() {
  redirect("/settings");
}
