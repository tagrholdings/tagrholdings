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
from ..pricing import openai_cost_usd
from ..shared import SPEC
from .extractor import to_extracted_fields

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


class OpenAIListingsExtractor:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        if client is None:
            from openai import OpenAI  # imported lazily: tests inject a fake client

            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is not set.")
            client = OpenAI(api_key=settings.openai_api_key, max_retries=3, timeout=60)
        self._client = client
        self._settings = settings

    def extract(self, text: str, source_type: str = "broker_website") -> ListingsExtraction:
        text = text[:MAX_INPUT_CHARS]
        try:
            response = self._client.chat.completions.create(
                model=self._settings.openai_model,
                messages=[
                    {"role": "system", "content": _LISTINGS["systemPrompt"]},
                    {"role": "user", "content": f"Source type: {source_type}\n\n--- BEGIN EMAIL TEXT ---\n{text}\n--- END EMAIL TEXT ---"},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "listing_digest_extraction", "strict": True, "schema": _LISTINGS["outputSchema"]},
                },
                max_completion_tokens=_LISTINGS["maxOutputTokens"],
            )
        except Exception:  # noqa: BLE001 - one bad call must not stop the crawl
            log.exception("Listing extraction request failed")
            return ListingsExtraction(failed=True)

        usage = getattr(response, "usage", None)
        input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model = getattr(response, "model", None) or self._settings.openai_model
        event = UsageEvent(
            provider="openai",
            operation="extract",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=openai_cost_usd(
                model, input_tokens, output_tokens, self._settings.openai_input_usd_per_million, self._settings.openai_output_usd_per_million
            ),
        )
        try:
            parsed = json.loads(response.choices[0].message.content or "{}")
            if not isinstance(parsed, dict):
                raise ValueError("not an object")
        except (json.JSONDecodeError, ValueError):
            log.warning("Listing extraction returned unusable output")
            return ListingsExtraction(usage=event, failed=True)  # the call happened, so it is billed
        return ListingsExtraction(listings=parse_listings(parsed, text), usage=event)
