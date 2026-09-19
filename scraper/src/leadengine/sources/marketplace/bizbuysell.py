"""BizBuySell — "businesses for sale" listings, scraped with Playwright.

READ THIS BEFORE RELYING ON IT
  * Marketplaces guard their listings. BizBuySell serves bot-protection pages to
    headless browsers and its terms restrict automated access. This adapter is
    deliberately polite (robots.txt, one page load every few seconds, an honest
    user agent) and deliberately gives up — raising SourceBlocked — the moment it
    meets a block page, a 403/429 or a captcha. It never tries to get around one.
  * The CSS/URL patterns below are written from BizBuySell's public listing URL
    scheme and have NOT been verified against the live site from this repo's
    test environment. Expect to adjust them (see `_LISTING_HREF`) the first time
    you run it for real; the parsing is isolated in `parse_listings` for that.
  * Turn the "Marketplaces" source off on a profile to skip it entirely.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterator
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from ...models import SOURCE_MARKETPLACE, Candidate, SearchProfile
from ..base import SourceBlocked, SourceContext, SourceError

log = logging.getLogger(__name__)

BASE = "https://www.bizbuysell.com"
MAX_PAGES = 2
PAGE_LOAD_TIMEOUT_MS = 45_000

# Listing detail URLs look like /Business-Opportunity/<slug>/<numeric-id>/
_LISTING_HREF = re.compile(r"/business-opportunity/[^/]+/(\d+)/?", re.IGNORECASE)
_BLOCK_MARKERS = ("access denied", "captcha", "are you a human", "unusual traffic", "request blocked", "pardon our interruption")

US_STATES = {
    "AL": "alabama", "AK": "alaska", "AZ": "arizona", "AR": "arkansas", "CA": "california", "CO": "colorado",
    "CT": "connecticut", "DE": "delaware", "FL": "florida", "GA": "georgia", "HI": "hawaii", "ID": "idaho",
    "IL": "illinois", "IN": "indiana", "IA": "iowa", "KS": "kansas", "KY": "kentucky", "LA": "louisiana",
    "ME": "maine", "MD": "maryland", "MA": "massachusetts", "MI": "michigan", "MN": "minnesota",
    "MS": "mississippi", "MO": "missouri", "MT": "montana", "NE": "nebraska", "NV": "nevada",
    "NH": "new-hampshire", "NJ": "new-jersey", "NM": "new-mexico", "NY": "new-york", "NC": "north-carolina",
    "ND": "north-dakota", "OH": "ohio", "OK": "oklahoma", "OR": "oregon", "PA": "pennsylvania",
    "RI": "rhode-island", "SC": "south-carolina", "SD": "south-dakota", "TN": "tennessee", "TX": "texas",
    "UT": "utah", "VT": "vermont", "VA": "virginia", "WA": "washington", "WV": "west-virginia",
    "WI": "wisconsin", "WY": "wyoming",
}


def search_url(profile: SearchProfile, term: str, page: int) -> str | None:
    slug = US_STATES.get(profile.state.strip().upper()) or profile.state.strip().lower().replace(" ", "-")
    if not slug:
        return None
    url = f"{BASE}/{slug}-businesses-for-sale/?q={quote(term)}"
    return url if page == 1 else f"{url}&pg={page}"


def parse_listings(html: str, page_url: str) -> list[Candidate]:
    """Turns one results page into candidates. Pure function — unit-tested against fixture HTML."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    candidates: list[Candidate] = []
    for anchor in soup.find_all("a", href=_LISTING_HREF):
        match = _LISTING_HREF.search(anchor["href"])
        assert match is not None
        listing_id = match.group(1)
        if listing_id in seen:
            continue
        title = anchor.get_text(" ", strip=True)
        if not title:
            continue
        seen.add(listing_id)

        # The listing "card" is the nearest ancestor that also holds the price/location text.
        card = anchor
        for _ in range(4):
            if card.parent is None:
                break
            card = card.parent
            if len(card.get_text(" ", strip=True)) > len(title) + 40:
                break
        card_text = re.sub(r"\s+", " ", card.get_text(" ", strip=True))[:1500]
        url = urljoin(page_url, anchor["href"])
        candidates.append(
            Candidate(
                source_type=SOURCE_MARKETPLACE,
                dedupe_key=f"bizbuysell:{listing_id}",
                business_name=title[:200],
                source_url=url,
                text=f"Marketplace: BizBuySell (business for sale)\nListing: {title}\nURL: {url}\nCard text: {card_text}",
            )
        )
    return candidates


def looks_blocked(html: str) -> bool:
    head = html[:4000].lower()
    return any(marker in head for marker in _BLOCK_MARKERS)


class BizBuySellSource:
    source_type = SOURCE_MARKETPLACE

    def search(self, profile: SearchProfile, term: str, ctx: SourceContext) -> Iterator[list[Candidate]]:
        try:
            from playwright.sync_api import Error as PlaywrightError
            from playwright.sync_api import sync_playwright
        except ImportError as exc:  # pragma: no cover - depends on the environment
            raise SourceError("Playwright is not installed (pip install playwright && playwright install chromium).") from exc

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                context = browser.new_context(user_agent=ctx.settings.user_agent, locale="en-US")
                page = context.new_page()
                for page_number in range(1, MAX_PAGES + 1):
                    url = search_url(profile, term, page_number)
                    if url is None:
                        raise SourceError(f"Can't build a BizBuySell URL for state {profile.state!r}.")
                    if not ctx.robots.allowed(url):
                        raise SourceBlocked("robots.txt disallows this BizBuySell search page.")
                    ctx.throttle.wait("www.bizbuysell.com")
                    try:
                        response = page.goto(url, timeout=PAGE_LOAD_TIMEOUT_MS, wait_until="domcontentloaded")
                    except PlaywrightError as exc:
                        raise SourceError(f"BizBuySell page load failed: {exc}") from exc
                    if response is not None and response.status in (403, 429):
                        raise SourceBlocked(f"BizBuySell answered {response.status} — stopping, not retrying.")
                    html = page.content()
                    if looks_blocked(html):
                        raise SourceBlocked("BizBuySell served a bot-protection page — stopping, not retrying.")
                    candidates = parse_listings(html, url)
                    if not candidates:
                        if ctx.on_empty_page is not None:
                            ctx.on_empty_page(html, url)
                        return
                    yield candidates
            finally:
                browser.close()
