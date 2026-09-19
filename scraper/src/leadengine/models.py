"""Plain data shapes shared across the engine. No I/O here."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

# The source ids double as the keys of `search_profiles.sources` (see
# modules/search-profiles/search-profiles.schema.ts) — keep them in sync.
SOURCE_GOOGLE_PLACES = "google_places"
SOURCE_BRAVE = "brave_search"
SOURCE_MARKETPLACE = "marketplace_scrape"
SOURCE_COMPANY_SITE = "company_site_scrape"  # enrichment toggle, not a discovery source

# Discovery order within one cycle.
DISCOVERY_SOURCES = (SOURCE_GOOGLE_PLACES, SOURCE_BRAVE, SOURCE_MARKETPLACE)


@dataclass
class SearchProfile:
    id: str
    tenant_id: str
    name: str
    category: str
    keywords: list[str]
    city: str
    state: str
    radius_miles: int
    sources: dict[str, bool]
    max_leads_per_run: int
    frequency_hours: int
    run_state: dict[str, Any] = field(default_factory=dict)
    last_run_at: datetime | None = None
    # Qualification criteria (camelCase keys, as the app stores them); only `signalKeywords` is used by the job.
    criteria: dict[str, Any] | None = None
    # Set by the CRM's "Run now"; cleared when this run starts.
    run_requested_at: datetime | None = None

    @property
    def terms(self) -> list[str]:
        """The category plus each extra keyword, de-duplicated, in order."""
        seen: set[str] = set()
        terms: list[str] = []
        for term in [self.category, *self.keywords]:
            cleaned = term.strip()
            if cleaned and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                terms.append(cleaned)
        return terms

    def source_enabled(self, source_type: str) -> bool:
        return bool(self.sources.get(source_type, False))


@dataclass
class Candidate:
    """One business/listing a source found, before enrichment and extraction."""

    source_type: str
    dedupe_key: str
    business_name: str
    source_url: str | None = None
    website: str | None = None
    # Text the source itself provided (a listing card, a search snippet, a Places record).
    text: str = ""
    # Structured facts the source already knows for sure (phone, address, ...).
    hints: dict[str, Any] = field(default_factory=dict)


@dataclass
class RawLead:
    """What gets written to `raw_leads`."""

    source_type: str
    dedupe_key: str
    business_name: str
    source_url: str | None
    raw_text: str
    extracted_fields: dict[str, Any]


@dataclass
class UsageEvent:
    """One billable call — becomes a `lead_api_usage` row."""

    provider: str  # openai | google_places | brave_search | google_geocoding
    operation: str  # text_search | search | geocode | extract
    cost_usd: float
    model: str | None = None
    requests: int = 1
    input_tokens: int | None = None
    output_tokens: int | None = None
