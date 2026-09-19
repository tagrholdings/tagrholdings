from __future__ import annotations

import logging
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger(__name__)


class RobotsCache:
    """robots.txt checks, one fetch per origin.

    4xx on robots.txt means "no rules" (allowed, per the standard). A robots.txt
    we couldn't read at all (5xx, timeout) is treated as DISALLOW — when in
    doubt the engine stays out.
    """

    def __init__(self, client: httpx.Client, user_agent: str) -> None:
        self._client = client
        self._user_agent = user_agent
        # origin -> parser, or None meaning "disallow everything".
        self._parsers: dict[str, RobotFileParser | None] = {}

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._parsers:
            self._parsers[origin] = self._load(origin)
        parser = self._parsers[origin]
        if parser is None:
            return False
        # Match on the product token ("TagrLeadEngine"), not the whole UA string.
        return parser.can_fetch(self._user_agent.split("/")[0], url)

    def _load(self, origin: str) -> RobotFileParser | None:
        parser = RobotFileParser()
        try:
            response = self._client.get(f"{origin}/robots.txt", timeout=10, follow_redirects=True)
        except httpx.HTTPError as exc:
            log.info("robots.txt unreachable for %s (%s) — treating as disallowed", origin, exc)
            return None
        if response.status_code >= 500:
            log.info("robots.txt returned %s for %s — treating as disallowed", response.status_code, origin)
            return None
        if response.status_code >= 400:
            parser.parse([])  # no rules
            return parser
        parser.parse(response.text.splitlines())
        return parser
