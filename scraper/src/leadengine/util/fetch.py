"""One polite GET, shared by the crawlers. Same rules as the company-site scraper: the URL (and every redirect
target) must be a public http(s) address, robots.txt is obeyed, requests to one host are spaced out, the response is
size-capped. A refusal is REPORTED (blocked) — never worked around."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from .ratelimit import DomainThrottle
from .robots import RobotsCache
from .urls import is_public_http_url

log = logging.getLogger(__name__)

MAX_BYTES = 800_000

# Words a security wall's page uses to tell a human from a robot ("Just a moment...", captcha, "Access denied").
_BOT_WALL = re.compile(r"just a moment|attention required|captcha|verify you are (a )?human|are you a robot|access denied|enable javascript and cookies", re.IGNORECASE)


def _is_bot_check(response: httpx.Response) -> bool:
    """A 401/403/429 that comes from an anti-bot wall (Cloudflare, Akamai, ...) rather than a plain "no"."""
    headers = response.headers
    if headers.get("cf-mitigated") or "cf-ray" in headers or "x-datadome" in headers or "x-sucuri-id" in headers:
        return True
    if "akamai" in headers.get("server", "").lower() or "px-" in " ".join(headers.keys()).lower():
        return True
    try:
        body = response.read()[:4000].decode("utf-8", errors="ignore")
    except httpx.HTTPError:
        return False
    return bool(_BOT_WALL.search(body))


# The site said no (robots.txt, or an HTTP status that means "not for robots"). A person checks these by hand.
BLOCKED = "blocked"
# Something went wrong (network, 5xx, 404, not HTML) — worth retrying later, nobody needs to look yet.
ERROR = "error"


@dataclass
class Fetched:
    html: str | None = None
    final_url: str | None = None
    problem: str | None = None  # BLOCKED | ERROR
    # A stable reason CODE, not prose: the app turns it into a sentence for people (modules/listing-sites/site-status.ts).
    # robots | bot_check | refused | rate_limited (blocked) — timeout | connection | server_error | not_found |
    # unreadable | http_error (error).
    detail: str | None = None

    @property
    def ok(self) -> bool:
        return self.html is not None


def polite_get(http: httpx.Client, robots: RobotsCache, throttle: DomainThrottle, url: str) -> Fetched:
    if not is_public_http_url(url):
        return Fetched(problem=ERROR, detail="unreadable")
    if not robots.allowed(url):
        return Fetched(problem=BLOCKED, detail="robots")
    throttle.wait(urlsplit(url).netloc)
    try:
        with http.stream("GET", url, timeout=15, follow_redirects=True) as response:
            status = response.status_code
            if status in (401, 403, 429):
                if _is_bot_check(response):
                    return Fetched(problem=BLOCKED, detail="bot_check")
                return Fetched(problem=BLOCKED, detail="rate_limited" if status == 429 else "refused")
            if status in (404, 410):
                return Fetched(problem=ERROR, detail="not_found")
            if status >= 500:
                return Fetched(problem=ERROR, detail="server_error")
            if status != 200:
                return Fetched(problem=ERROR, detail="http_error")
            if "html" not in response.headers.get("content-type", "").lower():
                return Fetched(problem=ERROR, detail="unreadable")
            # A redirect may have landed somewhere non-public — check the final URL too.
            if not is_public_http_url(str(response.url)):
                return Fetched(problem=ERROR, detail="unreadable")
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
        return Fetched(problem=ERROR, detail="timeout" if isinstance(exc, httpx.TimeoutException) else "connection")
