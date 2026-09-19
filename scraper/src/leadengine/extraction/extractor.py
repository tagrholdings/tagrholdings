"""AI extraction: raw text -> `extractedFields` (the JSON stored on `raw_leads`).

Currently backed by OpenAI (chat completions + strict JSON-schema output). The
stage is isolated behind `Extractor.extract` so swapping the provider (the
project is meant to move to Claude Haiku later) touches only this module and
pricing.py — nothing else in the engine knows which model ran.
"""

from __future__ import annotations

import json
import re
import logging
import math
from dataclasses import dataclass
from typing import Any, Protocol

from ..config import Settings
from ..models import Candidate, UsageEvent
from ..pricing import openai_cost_usd
from .prompt import OUTPUT_SCHEMA, SYSTEM_PROMPT, build_user_message

log = logging.getLogger(__name__)


@dataclass
class Extraction:
    fields: dict[str, Any]
    usage: UsageEvent | None  # None when no billable call happened


class Extractor(Protocol):
    def extract(self, candidate: Candidate, text: str) -> Extraction: ...


# The model sometimes writes "null" / "N/A" as TEXT for a missing fact; it must not reach the inbox as a value.
_NOT_A_VALUE = re.compile(r"^(null|none|n/a|na|unknown|not (stated|specified|provided|available))\.?$", re.IGNORECASE)


def _clean(value: Any) -> str | None:
    if isinstance(value, str):
        value = value.strip()
        return value if value and not _NOT_A_VALUE.match(value) else None
    return None


def _number(value: Any) -> int | float | None:
    """A finite number, else None. Booleans are not numbers here; whole floats become ints."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return int(value) if float(value).is_integer() else value


def to_extracted_fields(model_output: dict[str, Any], hints: dict[str, Any]) -> dict[str, Any]:
    """Maps the model's flat output onto the nested `ExtractedFields` shape the app
    reads (modules/leads/leads.schema.ts). `hints` — facts the source knew for sure,
    e.g. the phone number Google Places returned — fill any gap the model left."""

    def pick(key: str, hint_key: str | None = None) -> str | None:
        return _clean(model_output.get(key)) or (_clean(hints.get(hint_key or key)) if hints else None)

    signals = model_output.get("signals")
    return {
        "businessName": pick("business_name"),
        "industry": pick("industry"),
        "summary": _clean(model_output.get("summary")),
        "location": {
            "address": pick("address"),
            "city": pick("city"),
            "state": pick("state"),
        },
        "website": pick("website"),
        "contact": {
            "name": _clean(model_output.get("contact_name")),
            "email": pick("contact_email", "email"),
            "phone": pick("contact_phone", "phone"),
        },
        "estimatedRevenue": _clean(model_output.get("estimated_revenue")),
        "askingPrice": _clean(model_output.get("asking_price")),
        "reasonForSelling": _clean(model_output.get("reason_for_selling")),
        "employees": _clean(model_output.get("employees")),
        "yearsInBusiness": _clean(model_output.get("years_in_business")),
        # Numeric twins of the text fields above, only when the source stated the figure —
        # what a search profile's qualification criteria are checked against.
        "estimatedRevenueUsd": _number(model_output.get("estimated_revenue_usd")),
        "annualProfitUsd": _number(model_output.get("annual_profit_usd")),
        "askingPriceUsd": _number(model_output.get("asking_price_usd")),
        "employeesCount": _number(model_output.get("employees_count")),
        "yearsInBusinessCount": _number(model_output.get("years_in_business_count")),
        "signals": [s.strip() for s in signals if isinstance(s, str) and s.strip()][:6] if isinstance(signals, list) else [],
    }


def fields_from_hints_only(candidate: Candidate) -> dict[str, Any]:
    """Fallback when extraction is unavailable/failed: keep what the source told us, so the
    lead is still reviewable (name, phone, address, website) rather than lost."""
    hints = candidate.hints
    return to_extracted_fields(
        {
            "business_name": candidate.business_name,
            "website": candidate.website,
            "address": hints.get("address"),
            "contact_phone": hints.get("phone"),
            "industry": hints.get("industry"),
        },
        hints,
    )


class OpenAIExtractor:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        if client is None:
            from openai import OpenAI  # imported lazily: tests inject a fake client

            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is not set.")
            client = OpenAI(api_key=settings.openai_api_key, max_retries=3, timeout=60)
        self._client = client
        self._settings = settings

    def extract(self, candidate: Candidate, text: str) -> Extraction:
        response = self._client.chat.completions.create(
            model=self._settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_message(candidate.business_name, candidate.source_type, text)},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "lead_extraction", "strict": True, "schema": OUTPUT_SCHEMA},
            },
            max_completion_tokens=800,
        )
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
                model,
                input_tokens,
                output_tokens,
                self._settings.openai_input_usd_per_million,
                self._settings.openai_output_usd_per_million,
            ),
        )
        content = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            log.warning("Extraction returned non-JSON for %r; keeping source hints only.", candidate.business_name)
            # The call was made and billed even though its output was unusable.
            return Extraction(fields_from_hints_only(candidate), event)
        return Extraction(to_extracted_fields(parsed, candidate.hints), event)
