"""List prices used to ESTIMATE what each API call costs.

These are the providers' public per-unit prices, copied here on purpose (there
is no API that returns "what did this call cost"). They are estimates:
  * free monthly allowances / credits are NOT subtracted, so the real invoice
    can be lower;
  * prices change — when one does, update it HERE (one place). Verify against
    https://mapsplatform.google.com/pricing/ and https://openai.com/api/pricing/.
Last reviewed: 2026-09. Amounts are USD.
"""

from __future__ import annotations

import logging

from .shared import SPEC

log = logging.getLogger(__name__)

# Places API (New) — Text Search. Our field mask includes phone, website and
# rating, which bill at the "Enterprise" tier ($35 per 1,000 requests). One
# billable request per page returned, not per business.
GOOGLE_PLACES_TEXT_SEARCH_USD = 0.035

# Brave Search API (Search plan) — $5 per 1,000 requests, with $5 of free credit each month
# (not subtracted here). One billable request per page of up to 20 results.
BRAVE_SEARCH_USD = 0.005

# Geocoding API — $5 per 1,000 requests. Called once per profile (then cached).
GOOGLE_GEOCODING_USD = 0.005

# USD per 1,000,000 tokens: (input, output). Keys are matched as a prefix of the
# model name the API reports (which carries a date suffix, e.g.
# "gpt-4o-mini-2024-07-18"), longest key first. The table lives in
# shared/lead-engine-spec.json so the Next.js app (which also calls OpenAI, for
# manual and email leads) prices calls from the very same numbers.
OPENAI_USD_PER_MILLION: dict[str, tuple[float, float]] = {
    model: (rates[0], rates[1]) for model, rates in SPEC["pricing"]["openaiUsdPerMillion"].items()
}

# Used (with a warning) for a model that isn't in the table and has no override:
# deliberately the priciest small-model rate, so an unknown model is over- rather
# than under-estimated.
_FALLBACK_OPENAI_RATE = tuple(SPEC["pricing"]["openaiFallbackUsdPerMillion"])


def openai_cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
    input_override: float | None = None,
    output_override: float | None = None,
) -> float:
    if input_override is not None and output_override is not None:
        rate_in, rate_out = input_override, output_override
    else:
        match = next(
            (key for key in sorted(OPENAI_USD_PER_MILLION, key=len, reverse=True) if model.startswith(key)),
            None,
        )
        if match is None:
            log.warning(
                "No price known for OpenAI model %r — using a conservative fallback estimate. "
                "Add it to pricing.py or set OPENAI_INPUT_USD_PER_MILLION / OPENAI_OUTPUT_USD_PER_MILLION.",
                model,
            )
            rate_in, rate_out = _FALLBACK_OPENAI_RATE
        else:
            rate_in, rate_out = OPENAI_USD_PER_MILLION[match]
    return (input_tokens * rate_in + output_tokens * rate_out) / 1_000_000
