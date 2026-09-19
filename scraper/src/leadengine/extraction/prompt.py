"""The extraction stage's prompt and output schema.

Stage 1 of the two AI stages (see .agents/rules/lead-pipeline.md): turn
unstructured text about a business into structured fields. It does NOT judge,
score or rank — that's the deferred analysis stage, kept out of this module.

The prompt text and the JSON schema live in shared/lead-engine-spec.json, which
the Next.js app also reads (it extracts manual and email leads in real time) —
so both sides always ask the model the same thing.
"""

from __future__ import annotations

from ..shared import SPEC

_EXTRACTION = SPEC["extraction"]

# Text is capped before it's sent: ~6k characters is ~1.5k tokens, enough for a
# listing or a homepage's substance, and bounds the per-lead AI cost.
MAX_INPUT_CHARS: int = _EXTRACTION["maxInputChars"]

SYSTEM_PROMPT: str = _EXTRACTION["systemPrompt"]

# OpenAI strict structured outputs: every property required, no extras, nullable via a type union.
OUTPUT_SCHEMA: dict = _EXTRACTION["outputSchema"]


def build_user_message(business_name: str, source_type: str, text: str) -> str:
    return (
        f"Source type: {source_type}\n"
        f"Name as listed by the source: {business_name}\n\n"
        f"--- BEGIN SCRAPED TEXT ---\n{text[:MAX_INPUT_CHARS]}\n--- END SCRAPED TEXT ---"
    )
