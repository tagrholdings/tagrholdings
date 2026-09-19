"""Signal-keyword matching for a search profile's qualification criteria.

Only the keyword part of the criteria is evaluated here, because the job is the one that holds a lead's FULL
text. The numeric requirements (revenue, profit, size…) are checked by the app against the extraction's
numeric fields (modules/search-profiles/fit.ts) — so editing a profile's criteria re-scores existing leads
without re-running anything. The keyword result is stored on the lead as `matchedSignals`.
"""

from __future__ import annotations

import re
from typing import Any


def match_signals(criteria: dict[str, Any] | None, *texts: str | None) -> list[str]:
    """Which of the profile's signal keywords appear in the given texts (case-insensitive, whole words/phrases)."""
    keywords = (criteria or {}).get("signalKeywords") or []
    haystack = "\n".join(t for t in texts if t)
    if not keywords or not haystack:
        return []
    found: list[str] = []
    for keyword in keywords:
        cleaned = str(keyword).strip()
        if not cleaned:
            continue
        # \b on both sides so "retiring" doesn't match inside "retiringly"-style words; phrases match with flexible spaces.
        pattern = r"\b" + r"\s+".join(re.escape(part) for part in cleaned.split()) + r"\b"
        if re.search(pattern, haystack, re.IGNORECASE) and cleaned not in found:
            found.append(cleaned)
    return found
