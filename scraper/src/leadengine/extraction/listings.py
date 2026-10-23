"""AI extraction for a PAGE OR EMAIL THAT LISTS SEVERAL BUSINESSES FOR SALE (a broker's listings page): one call returns
one object per listing. The prompt and schema live in shared/lead-engine-spec.json (`listingsExtraction`), the same
contract the Next.js app uses for listing emails — and `parse_listings` here mirrors `parseListings` there, including
the rule that a listing's link is only trusted if it literally appears in the text the model was given."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol
from urllib.parse import urlsplit

from ..config import Settings
from ..models import UsageEvent
from ..pricing import gemini_cost_usd
from ..shared import SPEC
from .extractor import to_extracted_fields
from .gemini_client import GenerateJson, generate_json, parse_json_object

log = logging.getLogger(__name__)

_LISTINGS = SPEC["listingsExtraction"]
MAX_INPUT_CHARS: int = _LISTINGS["maxInputChars"]
MAX_LISTINGS: int = _LISTINGS["maxListings"]


@dataclass
class ExtractedListing:
    fields: dict[str, Any]
    # http(s) URL that appears literally in the source text, else None.
    listing_url: str | None


@dataclass
class ListingsExtraction:
    listings: list[ExtractedListing] = field(default_factory=list)
    usage: UsageEvent | None = None  # None when no billable call happened
    failed: bool = False  # the AI step failed (as opposed to "it ran and found nothing")


class ListingsExtractor(Protocol):
    def extract(self, text: str, source_type: str = ...) -> ListingsExtraction: ...


def _clean(value: Any) -> str | None:
    return value.strip() or None if isinstance(value, str) else None


def _verified_url(value: Any, source_text: str) -> str | None:
    candidate = _clean(value)
    if not candidate or len(candidate) > 2048:
        return None
    parts = urlsplit(candidate)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return None
    return candidate if candidate in source_text else None


def parse_listings(parsed: dict[str, Any], source_text: str) -> list[ExtractedListing]:
    raw = parsed.get("listings")
    listings: list[ExtractedListing] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        fields = to_extracted_fields(item, {})
        url = _verified_url(item.get("listing_url"), source_text)
        # A listing needs at least a title or a link to be worth a row.
        if not fields.get("businessName") and not url:
            continue
        listings.append(ExtractedListing(fields, url))
        if len(listings) >= MAX_LISTINGS:
            break
    return listings


class GeminiListingsExtractor:
    def __init__(self, settings: Settings, generate: GenerateJson | None = None) -> None:
        if generate is None and not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set.")
        self._generate = generate or generate_json  # tests inject a fake
        self._settings = settings

    def extract(self, text: str, source_type: str = "broker_website") -> ListingsExtraction:
        text = text[:MAX_INPUT_CHARS]
        try:
            answer = self._generate(
                self._settings,
                _LISTINGS["systemPrompt"],
                f"Source type: {source_type}\n\n--- BEGIN EMAIL TEXT ---\n{text}\n--- END EMAIL TEXT ---",
                _LISTINGS["outputSchema"],
                _LISTINGS["maxOutputTokens"],
            )
        except Exception:  # noqa: BLE001 - one bad call must not stop the crawl
            log.exception("Listing extraction request failed")
            return ListingsExtraction(failed=True)

        event = UsageEvent(
            provider="gemini",
            operation="extract",
            model=answer.model,
            input_tokens=answer.input_tokens,
            output_tokens=answer.output_tokens,
            cost_usd=gemini_cost_usd(
                answer.model,
                answer.input_tokens,
                answer.output_tokens,
                self._settings.gemini_input_usd_per_million,
                self._settings.gemini_output_usd_per_million,
            ),
        )
        parsed = parse_json_object(answer)
        if parsed is None:
            log.warning("Listing extraction returned unusable output")
            return ListingsExtraction(usage=event, failed=True)  # the call happened, so it is billed
        return ListingsExtraction(listings=parse_listings(parsed, text), usage=event)
