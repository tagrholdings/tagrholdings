from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from ..config import Settings
from ..models import Candidate, SearchProfile, UsageEvent
from ..util.ratelimit import DomainThrottle
from ..util.robots import RobotsCache


class SourceError(RuntimeError):
    """A source failed. The run records it and carries on with the other sources."""


class SourceNotConfigured(SourceError):
    """A credential this source needs is missing — skipped, not an error worth alarming on."""


class SourceBlocked(SourceError):
    """The site refused us (403/429/captcha/robots). We stop, we do not try to get around it."""


@dataclass
class SourceContext:
    settings: Settings
    http: httpx.Client
    robots: RobotsCache
    throttle: DomainThrottle
    # Called for every billable call, right after it happens.
    record_usage: Callable[[UsageEvent], None]
    # Mutable copy of the profile's run_state; sources may cache things in it
    # (the geocode of city+state) and the runner persists it.
    state: dict[str, Any] = field(default_factory=dict)
    # Optional: called as (html, url) with a page a source visited expecting listings but got none from. The
    # runner uses it to spot "listings by email signup" pages (enrich/email_signup_detect). Must never raise.
    on_empty_page: Callable[[str, str], None] | None = None
    # The listing-sites list (Database, bound by the runner): sources that crawl broker sites read and update it.
    store: Any | None = None


class Source(Protocol):
    source_type: str

    def search(self, profile: SearchProfile, term: str, ctx: SourceContext) -> Iterator[list[Candidate]]:
        """Yield pages of candidates for one search term. Raise SourceError on failure."""
        ...
