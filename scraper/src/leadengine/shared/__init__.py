"""Data shared with the Next.js app (which imports the same JSON file)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SPEC_PATH = Path(__file__).with_name("lead-engine-spec.json")

# Loaded once at import; a malformed spec should fail loudly at startup, not mid-run.
SPEC: dict[str, Any] = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
