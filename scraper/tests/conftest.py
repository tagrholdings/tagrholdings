from __future__ import annotations

import httpx
import pytest

from leadengine.config import Settings
from leadengine.models import SearchProfile
from leadengine.util.ratelimit import DomainThrottle
from leadengine.util.robots import RobotsCache


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="postgresql://unused",
        google_api_key="test-key",
        brave_api_key="test-brave",
        openai_api_key="test-openai",
        openai_model="gpt-4o-mini",
        user_agent="TagrLeadEngine/1.0 (+https://example.test)",
    )


@pytest.fixture
def profile() -> SearchProfile:
    return SearchProfile(
        id="11111111-1111-1111-1111-111111111111",
        tenant_id="22222222-2222-2222-2222-222222222222",
        name="HVAC Phoenix",
        category="HVAC contractors",
        keywords=["air conditioning repair"],
        city="Phoenix",
        state="AZ",
        radius_miles=25,
        sources={"google_places": True, "brave_search": False, "company_site_scrape": True, "marketplace_scrape": False},
        max_leads_per_run=25,
        frequency_hours=24,
    )


def make_ctx(settings: Settings, handler, state=None, usage=None):
    """A SourceContext whose HTTP goes to `handler` (an httpx MockTransport handler)."""
    from leadengine.sources.base import SourceContext

    http = httpx.Client(transport=httpx.MockTransport(handler))
    events = usage if usage is not None else []
    return SourceContext(
        settings=settings,
        http=http,
        robots=RobotsCache(http, settings.user_agent),
        throttle=DomainThrottle(min_interval=0, jitter=0, sleep=lambda _s: None),
        record_usage=events.append,
        state=state if state is not None else {},
    )
