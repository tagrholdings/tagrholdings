"""The ONE place the engine talks to Gemini: a `generateContent` call whose answer is a JSON object that follows a JSON
Schema. REST over httpx (already a dependency) — no SDK — the same request the Next.js app makes
(lib/gemini.ts `generateGeminiJson`), with the same shared schemas from shared/lead-engine-spec.json.

Everything else in the engine (extractor.py, listings.py) depends on the `GenerateJson` shape below, so tests hand them a
fake and a different provider is a different function with the same signature."""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

import httpx

from ..config import Settings

log = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT_SECONDS = 60.0
# Rate limits and a busy model are answered with these; anything else (a bad request, a bad key) will not get better.
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 4  # the first try and three retries, with a growing pause


class GeminiError(RuntimeError):
    """The call failed (no key, HTTP error, network). Never carries the key — only the status."""


@dataclass
class GeminiAnswer:
    text: str  # "" when the model produced no content
    model: str  # what the API reports it ran (prices are matched on this)
    input_tokens: int
    output_tokens: int  # INCLUDES thinking tokens — they are billed as output
    truncated: bool  # the reply hit the output-token limit, so `text` is cut off


# (settings, system prompt, user message, JSON Schema, max output tokens) -> the answer
GenerateJson = Callable[[Settings, str, str, dict[str, Any], int], GeminiAnswer]


def _thinking_off(model: str) -> bool:
    """Thinking is billed as output and buys nothing for copying facts out of a text, so it is switched off where the
    model allows it (the 2.5 Flash family). Other families keep their default; their thinking tokens are still counted."""
    return re.match(r"^gemini-2\.5-flash", model) is not None


def generate_json(
    settings: Settings,
    system: str,
    user: str,
    schema: dict[str, Any],
    max_output_tokens: int,
    *,
    http: httpx.Client | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> GeminiAnswer:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not set.")
    model = settings.gemini_model
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
            # Gemini takes the spec's JSON Schema as is (type arrays with "null", additionalProperties and all).
            "responseJsonSchema": schema,
            **({"thinkingConfig": {"thinkingBudget": 0}} if _thinking_off(model) else {}),
        },
    }
    url = f"{GEMINI_URL}/{model}:generateContent"
    headers = {"x-goog-api-key": settings.gemini_api_key}
    client = http or httpx.Client(timeout=TIMEOUT_SECONDS)

    data: dict[str, Any] | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        pause = min(2.0**attempt, 20.0)
        try:
            response = client.post(url, headers=headers, json=body)
        except httpx.TransportError as exc:
            if attempt == MAX_ATTEMPTS:
                raise GeminiError(f"Gemini request failed: {type(exc).__name__}") from exc
            log.warning("Gemini request failed (%s); retrying in %.0fs", type(exc).__name__, pause)
            sleep(pause)
            continue
        if response.status_code in RETRY_STATUSES and attempt < MAX_ATTEMPTS:
            log.warning("Gemini answered %s; retrying in %.0fs", response.status_code, pause)
            sleep(pause)
            continue
        if response.status_code >= 400:
            raise GeminiError(f"Gemini answered {response.status_code}")
        data = response.json()
        break
    assert data is not None  # the loop either returned a body or raised

    usage = data.get("usageMetadata") or {}
    candidate = (data.get("candidates") or [{}])[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    return GeminiAnswer(
        text="".join(str(part.get("text", "")) for part in parts),
        model=str(data.get("modelVersion") or model),
        input_tokens=int(usage.get("promptTokenCount") or 0),
        output_tokens=int(usage.get("candidatesTokenCount") or 0) + int(usage.get("thoughtsTokenCount") or 0),
        truncated=candidate.get("finishReason") == "MAX_TOKENS",
    )


def parse_json_object(answer: GeminiAnswer) -> dict[str, Any] | None:
    """The answer as a JSON object, or None when it isn't one (cut off, not JSON, an array...)."""
    if answer.truncated:
        return None
    try:
        parsed = json.loads(answer.text or "{}")
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None
