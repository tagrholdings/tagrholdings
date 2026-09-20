"""Broker listing sites — businesses that are FOR SALE, read straight from the brokers' own websites.

This is how a person does it by hand: search Google for business brokers in the region, open each broker's
"Buy a business" / "Available listings" page, look at the industries they care about. The source does the same:

  1. DISCOVER brokers: Brave searches ("business brokers <state>", "<industry> business for sale broker <state>")
     add new sites to the tenant's `listing_sites` list (at most once a week, and never a site that is already on the
     list — including ones a person told us to ignore).
  2. CRAWL each active site politely (robots.txt, throttled, honest user agent): find its listings page, follow the
     category pages named after the profile's industries and the "next page" links, and have the AI extract every
     business listed. A page whose text hasn't changed since the last run costs no AI call.
  3. Each business becomes a candidate whose fields are ALREADY extracted (the runner saves it as-is), pointing at the
     listing's own link.

A site that refuses robots (robots.txt / 403 / 429) is recorded as `blocked` and left for a person to check — never
worked around. Nothing here is specific to one broker: layouts differ, which is why the AI reads the page.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

from ..extraction.listings import ExtractedListing, ListingsExtractor
from ..models import SOURCE_BROKER_LISTINGS, Candidate, ListingSite, SearchProfile
from ..util.fetch import BLOCKED, Fetched, polite_get
from ..util.pages import (
    content_hash,
    find_industry_pages,
    find_listing_pages,
    find_next_page,
    find_search_urls,
    industry_pattern,
    page_text_with_links,
)
from ..util.urls import clean_listing_url, is_aggregator, listing_key, normalize_url, registrable_domain
from .base import SourceContext, SourceError, SourceNotConfigured
from .brave_search import web_search

log = logging.getLogger(__name__)

# -- budgets -------------------------------------------------------------------------------------------------------
DISCOVERY_EVERY = timedelta(days=7)
MAX_NEW_SITES_PER_DISCOVERY = 20
MAX_INDUSTRY_TERMS_IN_DISCOVERY = 4
MAX_FETCHES_PER_SITE = 14  # every page opened on one site: listing pages + category pages + site-search results + next pages
MAX_LISTING_PAGES = 3  # how many "listings" links from the homepage to start from
MIN_PAGE_TEXT_CHARS = 300  # less than this is an empty shell (probably rendered with JavaScript)
RETRY_AFTER = {"blocked": timedelta(days=14), "no_listings": timedelta(days=14), "error": timedelta(days=1)}

_TITLE_SEPARATORS = re.compile(r"\s+[|\-–—·»:]\s+")
# A listing that is no longer available: marked in its title ("… – Sold", "Under Contract") or in its link path.
_UNAVAILABLE = re.compile(r"\b(sold|under contract|sale pending|off the market)\b", re.IGNORECASE)
_UNAVAILABLE_PATH = re.compile(r"(^|[-/_])sold([-/_.]|$)", re.IGNORECASE)
_ROUNDUP = re.compile(r"\b\d+\s+(best|top)\b|\b(best|top)\s+\d+\b|\bdirectory\b|\bnear me\b", re.IGNORECASE)


@dataclass
class CrawlResult:
    status: str  # ok | blocked | no_listings | error
    detail: str | None = None
    listings: list[tuple[ExtractedListing, str]] = field(default_factory=list)  # (listing, page it was found on)
    listings_url: str | None = None
    hashes: dict[str, str] = field(default_factory=dict)  # new/changed page hashes, keyed "<profile>|<url>"
    unchanged_pages: int = 0


def _site_name(title: str, domain: str) -> str:
    first = _TITLE_SEPARATORS.split(title.strip())[0].strip() if title else ""
    return (first if 2 <= len(first) <= 80 else domain)[:200]


def _no_longer_for_sale(name: str | None, listing_url: str | None) -> bool:
    return bool(
        (name and _UNAVAILABLE.search(name)) or (listing_url and _UNAVAILABLE_PATH.search(urlsplit(listing_url).path))
    )


def listing_signature(fields: dict[str, Any], listing_url: str | None) -> str | None:
    """Same identity the app gives a listing that arrives by email: name + place + asking price (the link when unnamed)."""
    name = (fields.get("businessName") or "").strip().lower()
    if name:
        location = fields.get("location") or {}
        basis = "|".join(
            str(part or "").strip().lower()
            for part in (name, location.get("city"), location.get("state"), fields.get("askingPrice") or fields.get("askingPriceUsd"))
        )
    elif listing_url:
        basis = normalize_url(listing_url)
    else:
        return None
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]


class BrokerListingsSource:
    source_type = SOURCE_BROKER_LISTINGS

    def __init__(self, extractor: ListingsExtractor | None, now: Any = None) -> None:
        self._extractor = extractor
        self._now = now or (lambda: datetime.now(timezone.utc))

    # -- entry point -------------------------------------------------------------------------------------------------

    def search(self, profile: SearchProfile, term: str, ctx: SourceContext) -> Iterator[list[Candidate]]:
        store = ctx.store
        if store is None:
            raise SourceNotConfigured("The listing-sites list is not available to this run.")
        if self._extractor is None:
            raise SourceNotConfigured("OPENAI_API_KEY is not set — listings can't be read without the AI step.")

        self._discover(profile, ctx)

        pattern = industry_pattern(profile.terms)
        for site in self._due_sites(store.listing_sites_for_crawl(profile.tenant_id)):
            result = self._crawl(site, profile, ctx, pattern)
            candidates = self._candidates(result, site, profile)
            if candidates:
                # Recorded only AFTER the runner has fully handled these candidates (a generator resumes only then):
                # if the run stops mid-way (lead cap, time limit) the site is crawled again next time instead of
                # having its unseen listings marked as done.
                yield candidates
            store.record_site_crawl(
                profile.tenant_id, site.id, result.status, result.detail, len(result.listings), result.listings_url, {**site.content_hashes, **result.hashes}
            )

    # -- which sites are worth a visit right now -----------------------------------------------------------------------

    def _due_sites(self, sites: list[ListingSite]) -> list[ListingSite]:
        # Postgres hands timestamps back naive (UTC): compare like with like.
        now = self._now().astimezone(timezone.utc).replace(tzinfo=None)
        due: list[ListingSite] = []
        for site in sites:
            wait = RETRY_AFTER.get(site.status)
            if wait and site.last_crawled_at and now - site.last_crawled_at < wait:
                continue  # blocked / empty / broken sites aren't hammered every run
            due.append(site)
        return due

    # -- discovery -------------------------------------------------------------------------------------------------------

    def _discovery_queries(self, profile: SearchProfile) -> list[str]:
        area = profile.state.strip()
        queries = [f"business brokers {area}", f"business broker {profile.city} {area}"]
        for term in profile.terms[:MAX_INDUSTRY_TERMS_IN_DISCOVERY]:
            queries.append(f"{term} business for sale broker {area}")
        return queries

    def _discover(self, profile: SearchProfile, ctx: SourceContext) -> None:
        if not ctx.settings.brave_api_key:
            log.info("BRAVE_API_KEY is not set — not looking for new brokers, crawling the ones already known.")
            return
        last = ctx.state.get("broker_discovery_at")
        if last:
            try:
                if self._now() - datetime.fromisoformat(last) < DISCOVERY_EVERY:
                    return
            except ValueError:
                pass

        known = ctx.store.known_site_domains(profile.tenant_id)
        added = 0
        for query in self._discovery_queries(profile):
            try:
                results = web_search(ctx, query)
            except SourceError as exc:
                log.warning("Broker discovery search %r failed: %s", query, exc)
                break
            for item in results:
                url = item.get("url") or ""
                title = re.sub(r"<[^>]+>", "", item.get("title") or "").strip()
                domain = registrable_domain(url)
                if not domain or domain in known or is_aggregator(url) or _ROUNDUP.search(title):
                    continue
                parts = urlsplit(url)
                site_url = f"{parts.scheme}://{parts.netloc}/"
                if ctx.store.add_discovered_site(profile.tenant_id, _site_name(title, domain), domain, site_url):
                    added += 1
                known.add(domain)
                if added >= MAX_NEW_SITES_PER_DISCOVERY:
                    break
            if added >= MAX_NEW_SITES_PER_DISCOVERY:
                break
        ctx.state["broker_discovery_at"] = self._now().isoformat()
        log.info("Broker discovery: %d new site(s) added to the list.", added)

    # -- crawl -------------------------------------------------------------------------------------------------------------

    def _crawl(self, site: ListingSite, profile: SearchProfile, ctx: SourceContext, pattern: re.Pattern[str] | None) -> CrawlResult:
        fetches = 0
        fetched: dict[str, Fetched] = {}

        def get(url: str) -> Fetched:
            nonlocal fetches
            if url in fetched:
                return fetched[url]
            fetches += 1
            fetched[url] = polite_get(ctx.http, ctx.robots, ctx.throttle, url)
            return fetched[url]

        entry = site.listings_url or site.site_url
        first = get(entry)
        if not first.ok:
            status = "blocked" if first.problem == BLOCKED else "error"
            return CrawlResult(status, first.detail)

        start_pages: list[str] = [site.listings_url] if site.listings_url else find_listing_pages(first.html or "", first.final_url or entry, MAX_LISTING_PAGES)
        if not start_pages and re.search(r"listing|for-sale|buy", urlsplit(entry).path, re.IGNORECASE):
            start_pages = [entry]
        if not start_pages:
            return CrawlResult("no_listings", "No page listing businesses for sale was found from the homepage.")

        # (url, industry_scoped): a page reached through a link NAMED after an industry (a category page) keeps ALL its
        # listings — the site already filtered them. Site-search results don't: a search that silently ignored our
        # keyword would return everything, so those go through the same industry filter as any page.
        queue: list[tuple[str, bool]] = [(u, False) for u in start_pages]
        visited: set[str] = set()
        result = CrawlResult("no_listings")
        empty_shells = 0
        wanted_terms = profile.terms
        searched = False

        while queue and fetches < MAX_FETCHES_PER_SITE:
            url, scoped = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            page = get(url)
            if not page.ok:
                if url == entry and page.problem == BLOCKED:
                    return CrawlResult("blocked", page.detail)
                continue
            html, final = page.html or "", page.final_url or url

            # Category pages named after the industries the profile wants; the site's own keyword search, once per
            # site (a person types "plumbing" in the box); then the next page of this one.
            for extra in find_industry_pages(html, final, pattern):
                if extra not in visited:
                    queue.append((extra, True))
            if not searched and pattern is not None:
                search_urls = find_search_urls(html, final, wanted_terms)
                if search_urls:
                    searched = True
                    queue.extend((u, False) for u in search_urls if u not in visited)
            nxt = find_next_page(html, final, final)
            if nxt and nxt not in visited:
                queue.append((nxt, scoped))

            text = page_text_with_links(html, final, 60_000)
            if len(text) < MIN_PAGE_TEXT_CHARS:
                empty_shells += 1
                continue
            key = f"{profile.id}|{final}"
            digest = content_hash(text)
            if site.content_hashes.get(key) == digest:
                result.unchanged_pages += 1
                continue

            extraction = self._extractor.extract(text) if self._extractor else None
            if extraction is None:
                continue
            if extraction.usage is not None:
                ctx.record_usage(extraction.usage)
            if extraction.failed:
                continue  # not hashed: it will be read again next time
            result.hashes[key] = digest
            result.listings_url = result.listings_url or final
            for listing in extraction.listings:
                haystack = " ".join(str(listing.fields.get(k) or "") for k in ("businessName", "industry", "summary"))
                if scoped or pattern is None or pattern.search(haystack):
                    result.listings.append((listing, final))

        if result.listings or result.unchanged_pages:
            result.status = "ok"
        elif empty_shells and empty_shells == len(visited):
            result.detail = "The listings page has no readable text — it may only render with JavaScript."
        else:
            result.detail = f"Read {len(visited)} page(s); no business for sale in {', '.join(wanted_terms) or 'any industry'} was found."
        return result

    # -- results -> candidates ---------------------------------------------------------------------------------------------

    def _candidates(self, result: CrawlResult, site: ListingSite, profile: SearchProfile) -> list[Candidate]:
        candidates: list[Candidate] = []
        seen: set[str] = set()
        for listing, page_url in result.listings:
            fields = dict(listing.fields)
            link = clean_listing_url(listing.listing_url) if listing.listing_url else None
            if _no_longer_for_sale(fields.get("businessName"), link):
                continue
            signature = listing_signature(fields, link)
            key = f"url:{listing_key(link)}" if link else (f"sig:{signature}" if signature else None)
            if key is None or key in seen:
                continue
            seen.add(key)
            if signature:
                fields["listingSignature"] = signature
            fields["broker"] = site.site_name
            name = fields.get("businessName") or f"Listing on {site.domain}"
            facts = [
                fields.get("summary"),
                f"Asking {fields['askingPrice']}" if fields.get("askingPrice") else None,
                f"Revenue {fields['estimatedRevenue']}" if fields.get("estimatedRevenue") else None,
                f"Listed by {site.site_name} ({site.domain})",
            ]
            candidates.append(
                Candidate(
                    source_type=SOURCE_BROKER_LISTINGS,
                    dedupe_key=key,
                    business_name=name,
                    source_url=link or page_url,
                    text="\n".join(str(f) for f in facts if f),
                    fields=fields,
                )
            )
        return candidates
