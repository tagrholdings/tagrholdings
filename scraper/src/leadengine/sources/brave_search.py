"""Brave Search API (Web Search) — finds company websites by keyword.

Replaces the Google Custom Search source: Google closed open-web search for new
Programmable Search Engines (new engines are limited to 50 listed domains), so it
can no longer find businesses we don't already know. Brave's independent index
answers an ordinary open-web query, billed per request.

Request:  GET /res/v1/web/search?q=…&count=20&offset=<page>   header X-Subscription-Token
Response: {"web": {"results": [{"title", "url", "description", …}]},
           "query": {"more_results_available": bool, …}}
Note `offset` is a PAGE index (0–9), not a result offset.
"""

from __future__ import annotations

import html
import logging
import re
import time
from collections.abc import Iterator

import httpx

from ..models import SOURCE_BRAVE, Candidate, SearchProfile, UsageEvent
from ..pricing import BRAVE_SEARCH_USD
from ..util.urls import host_of, is_aggregator, normalize_url
from .base import SourceContext, SourceError, SourceNotConfigured

log = logging.getLogger(__name__)

SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
PAGE_SIZE = 20  # API maximum per request
MAX_PAGES = 3  # 60 results per term at most
MAX_RATE_LIMIT_WAIT_SECONDS = 10

_TAG_RE = re.compile(r"<[^>]+>")
# "15 Best HVAC Contractors in Phoenix", "Top 10 …", "… near me", "… directory": roundup/listing
# pages, not a business's own site. Skipped before enrichment/AI so they cost nothing.
_LISTICLE_RE = re.compile(r"^\s*\d+\s+(best|top)\b|\b(best|top)\s+\d+\b|\bnear me\b|\bdirectory\b", re.IGNORECASE)

# Indirection so tests don't really sleep.
_sleep = time.sleep


def _plain(text: str | None) -> str:
    """Brave wraps matched words in <strong> and escapes entities — reduce to plain text."""
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub("", text or ""))).strip()


class BraveSearchSource:
    source_type = SOURCE_BRAVE

    def search(self, profile: SearchProfile, term: str, ctx: SourceContext) -> Iterator[list[Candidate]]:
        api_key = ctx.settings.brave_api_key
        if not api_key:
            raise SourceNotConfigured("BRAVE_API_KEY is not set.")

        query = f"{term} {profile.city} {profile.state}"
        headers = {"X-Subscription-Token": api_key, "Accept": "application/json"}

        for page in range(MAX_PAGES):
            params = {"q": query, "count": PAGE_SIZE, "offset": page, "country": "US", "search_lang": "en"}
            data = self._request(ctx, params, headers)

            # Billed per request Brave accepted (not per result).
            ctx.record_usage(UsageEvent(provider="brave_search", operation="search", cost_usd=BRAVE_SEARCH_USD))

            results = (data.get("web") or {}).get("results") or []
            candidates: list[Candidate] = []
            for item in results:
                link = item.get("url")
                title = _plain(item.get("title"))
                if not link or not title or is_aggregator(link) or _LISTICLE_RE.search(title):
                    continue
                snippet = _plain(item.get("description"))
                candidates.append(
                    Candidate(
                        source_type=SOURCE_BRAVE,
                        # One lead per website, however many of its pages match.
                        dedupe_key=host_of(link),
                        business_name=title.split(" - ")[0].split(" | ")[0].strip()[:200] or host_of(link),
                        source_url=link,
                        website=normalize_url(link),
                        text=f"Page title: {title}\nSearch snippet: {snippet}\nURL: {link}",
                    )
                )
            if candidates:
                yield candidates

            # Trust Brave's own flag rather than walking offsets blindly.
            if not results or (data.get("query") or {}).get("more_results_available") is False:
                return

    @staticmethod
    def _request(ctx: SourceContext, params: dict[str, str | int], headers: dict[str, str]) -> dict:
        for attempt in (1, 2):
            try:
                response = ctx.http.get(SEARCH_URL, params=params, headers=headers, timeout=30)
            except httpx.HTTPError as exc:
                raise SourceError(f"Brave Search request failed: {exc}") from exc

            if response.status_code == 429 and attempt == 1:
                wait = _retry_after_seconds(response)
                log.info("Brave Search rate limit hit — waiting %.1fs, then retrying once.", wait)
                _sleep(wait)
                continue
            if response.status_code in (401, 403):
                raise SourceError(
                    f"Brave Search rejected the API key ({response.status_code}) — check BRAVE_API_KEY and that the plan is active."
                )
            if response.status_code == 429:
                raise SourceError("Brave Search rate limit or monthly quota exceeded (429).")
            if response.status_code != 200:
                raise SourceError(f"Brave Search returned {response.status_code}: {response.text[:300]}")
            return response.json()
        raise SourceError("Brave Search request failed.")  # pragma: no cover - loop always returns/raises


def _retry_after_seconds(response: httpx.Response) -> float:
    for header in ("Retry-After", "X-RateLimit-Reset"):
        raw = response.headers.get(header)
        if raw:
            try:
                return min(max(float(raw.split(",")[0]), 1.0), MAX_RATE_LIMIT_WAIT_SECONDS)
            except ValueError:
                continue
    return 1.0
