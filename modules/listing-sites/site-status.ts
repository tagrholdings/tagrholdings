import type { ListingSiteStatus } from "./listing-sites.schema";

export type SiteStatusTone = "good" | "bad" | "neutral";

/** Things a person can do next; the screen turns each into a button. */
export type SiteStatusAction = "open_site" | "email_sources" | "add_site" | "ignore";

export interface SiteStatusExplanation {
  /** The badge. */
  label: string;
  tone: SiteStatusTone;
  /** One plain sentence: what happened. Shown in the table row. */
  short: string;
  /** Why it happens, in words for someone who has never heard of a "robot check". Shown in the details window. */
  why: string;
  /** What can be done about it, step by step. */
  steps: string[];
  /** Buttons offered in the details window. */
  actions: SiteStatusAction[];
}

const EMAIL_STEP = "Look for a “get new listings by email” form. If there is one, add the site under Email sources — its alerts will then arrive in your inbox on their own.";

const CLOSED_WHY =
  "Many websites protect themselves from automatic visitors. They let people in but stop programs, and this is one of them. The engine respects that: it never tries to get around a site's protection.";

/**
 * Turns what the job stored in `listing_sites.status_detail` into words for a non-technical reader.
 * The job writes a stable CODE there (scraper/src/leadengine/util/fetch.py + sources/broker_listings.py), optionally
 * with a number after a colon (`none_in_industries:3` = pages read). A code this doesn't know falls back to a
 * generic explanation for the status — raw technical text is never shown as the explanation.
 */
export function explainSiteStatus(status: ListingSiteStatus, detail: string | null): SiteStatusExplanation {
  const [code, arg] = (detail ?? "").split(":");
  const pages = Number(arg);

  switch (code) {
    case "bot_check":
      return {
        label: "Needs a human visit",
        tone: "bad",
        short: "The site shows an “are you human?” check to automatic visitors.",
        why: `When the engine opened this site, it was asked to prove it is a person (a security check, the kind that says “Verifying you are human”). ${CLOSED_WHY}`,
        steps: ["Open the site in your own browser — it will let you in.", "Look at its “businesses for sale” page for anything in your industries.", EMAIL_STEP],
        actions: ["open_site", "email_sources", "ignore"],
      };
    case "robots":
      return {
        label: "Closed to automatic visits",
        tone: "bad",
        short: "The site's own rules ask automatic tools to stay out.",
        why: "Every website can publish a public note (called robots.txt) saying which parts programs may not read. This site asks programs to stay out, and the engine follows that rule.",
        steps: ["Open the site in your own browser.", "Look at its “businesses for sale” page for anything in your industries.", EMAIL_STEP],
        actions: ["open_site", "email_sources", "ignore"],
      };
    case "refused":
      return {
        label: "Closed to automatic visits",
        tone: "bad",
        short: "The site turns away automatic visitors.",
        why: `The site answered “no” as soon as the engine knocked. ${CLOSED_WHY}`,
        steps: ["Open the site in your own browser.", "Look at its “businesses for sale” page for anything in your industries.", EMAIL_STEP],
        actions: ["open_site", "email_sources", "ignore"],
      };
    case "rate_limited":
      return {
        label: "Asked us to slow down",
        tone: "bad",
        short: "The site said we were visiting too often.",
        why: "The site limits how often a program may visit, and the engine hit that limit. It backs off on purpose.",
        steps: ["Nothing is needed: the engine tries again by itself in about two weeks.", "Meanwhile you can open the site yourself.", EMAIL_STEP],
        actions: ["open_site", "email_sources"],
      };
    case "timeout":
    case "connection":
      return {
        label: "Didn't answer",
        tone: "neutral",
        short: "The site was too slow or the connection dropped.",
        why: "The engine tried to open the site but it did not answer in time, or the connection was cut halfway. This is usually temporary — the site was busy or the internet hiccuped.",
        steps: ["Nothing is needed: the engine tries again by itself within a day.", "If it keeps showing up for days, open the site to check it still exists."],
        actions: ["open_site"],
      };
    case "server_error":
      return {
        label: "Site had a problem",
        tone: "neutral",
        short: "The site itself reported an error.",
        why: "The site's own server failed when the engine visited. That is a problem on their side, not ours.",
        steps: ["Nothing is needed: the engine tries again by itself within a day.", "If it keeps happening, the site may be down or closed — open it to check."],
        actions: ["open_site"],
      };
    case "not_found":
      return {
        label: "Page not found",
        tone: "neutral",
        short: "The address doesn't exist any more.",
        why: "The site answered that this page is gone. It may have moved to a new address or closed.",
        steps: ["Open the site to see if it moved.", "If it did, use Add site with the new address and ignore this one."],
        actions: ["open_site", "add_site", "ignore"],
      };
    case "unreadable":
    case "http_error":
      return {
        label: "Couldn't be read",
        tone: "neutral",
        short: "The page opened but the engine couldn't read it.",
        why: "The site answered, but with something the engine cannot read as a normal web page.",
        steps: ["The engine tries again by itself within a day.", "If it keeps happening, open the site by hand."],
        actions: ["open_site"],
      };
    case "no_listings_page":
      return {
        label: "No listings page found",
        tone: "neutral",
        short: "The engine found no “businesses for sale” page from the home page.",
        why: "The engine looks for a link such as “Buy a business” or “Current listings” on the home page and follows it. On this site it found none — often because the listings are hidden behind a search form or need a sign-up.",
        steps: [
          "Open the site and find the page that lists the businesses for sale.",
          "If you find it, use Add site and paste that page's address in “Page with the listings” — the engine will read it directly.",
          EMAIL_STEP,
        ],
        actions: ["open_site", "add_site", "email_sources", "ignore"],
      };
    case "js_only":
      return {
        label: "Listings not readable",
        tone: "neutral",
        short: "The listings load after the page opens, which the engine can't read.",
        why: "Some sites draw their list of businesses with a program that runs in your browser after the page opens. The engine reads the page as it first arrives, so it sees an empty page.",
        steps: ["Open the site to look at its listings by hand.", EMAIL_STEP],
        actions: ["open_site", "email_sources", "ignore"],
      };
    case "none_in_industries":
      return {
        label: "Nothing in your industries",
        tone: "neutral",
        short: `Read ${Number.isFinite(pages) && pages > 0 ? `${pages} page${pages === 1 ? "" : "s"}` : "the listings"}: none of the businesses for sale are in your industries.`,
        why: "The site works fine and the engine read its listings. It just has no business right now in the industries of your search profiles (for example HVAC or plumbing).",
        steps: [
          "Nothing is needed: the engine checks again in about two weeks.",
          "Some sites have a category filter the engine can't use. If you want to double-check, open the site and look at its categories yourself.",
        ],
        actions: ["open_site", "ignore"],
      };
  }

  switch (status) {
    case "ok":
      return { label: "Read", tone: "good", short: "", why: "", steps: [], actions: [] };
    case "pending":
      return { label: "Not read yet", tone: "neutral", short: "The engine hasn't visited this site yet.", why: "Sites are read on the engine's next run.", steps: ["Nothing is needed."], actions: [] };
    case "blocked":
      return { label: "Closed to automatic visits", tone: "bad", short: "The site turns away automatic visitors.", why: CLOSED_WHY, steps: ["Open the site in your own browser.", EMAIL_STEP], actions: ["open_site", "email_sources", "ignore"] };
    case "error":
      return { label: "Couldn't be read", tone: "neutral", short: "Something went wrong reading the site.", why: "The engine could not read this site this time.", steps: ["The engine tries again by itself within a day."], actions: ["open_site"] };
    default:
      return { label: "No matching listings", tone: "neutral", short: "No business in your industries was found.", why: "The engine read the site but found nothing that matches.", steps: ["The engine checks again in about two weeks."], actions: ["open_site", "ignore"] };
  }
}
