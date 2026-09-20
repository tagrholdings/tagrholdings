"""One polite GET, shared by the crawlers. Same rules as the company-site scraper: the URL (and every redirect
target) must be a public http(s) address, robots.txt is obeyed, requests to one host are spaced out, the response is
size-capped. A refusal is REPORTED (blocked) — never worked around."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from .ratelimit import DomainThrottle
from .robots import RobotsCache
from .urls import is_public_http_url

log = logging.getLogger(__name__)

MAX_BYTES = 800_000

# The site said no (robots.txt, or an HTTP status that means "not for robots"). A person checks these by hand.
BLOCKED = "blocked"
# Something went wrong (network, 5xx, 404, not HTML) — worth retrying later, nobody needs to look yet.
ERROR = "error"


@dataclass
class Fetched:
    html: str | None = None
    final_url: str | None = None
    problem: str | None = None  # BLOCKED | ERROR
    detail: str | None = None

    @property
    def ok(self) -> bool:
        return self.html is not None


def polite_get(http: httpx.Client, robots: RobotsCache, throttle: DomainThrottle, url: str) -> Fetched:
    if not is_public_http_url(url):
        return Fetched(problem=ERROR, detail="not a public web address")
    if not robots.allowed(url):
        return Fetched(problem=BLOCKED, detail="robots.txt does not allow automated access")
    throttle.wait(urlsplit(url).netloc)
    try:
        with http.stream("GET", url, timeout=15, follow_redirects=True) as response:
            status = response.status_code
            if status in (401, 403, 429):
                return Fetched(problem=BLOCKED, detail=f"the site refused automated access (HTTP {status})")
            if status != 200:
                return Fetched(problem=ERROR, detail=f"HTTP {status}")
            if "html" not in response.headers.get("content-type", "").lower():
                return Fetched(problem=ERROR, detail="not an HTML page")
            # A redirect may have landed somewhere non-public — check the final URL too.
            if not is_public_http_url(str(response.url)):
                return Fetched(problem=ERROR, detail="redirected to a non-public address")
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                chunks.append(chunk)
                size += len(chunk)
                if size >= MAX_BYTES:
                    break
            html = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
            return Fetched(html=html, final_url=str(response.url))
    except httpx.HTTPError as exc:
        log.info("Could not fetch %s: %s", url, exc)
        return Fetched(problem=ERROR, detail=type(exc).__name__)
