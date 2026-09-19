from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

from leadengine.criteria import match_signals
from leadengine.extraction.extractor import to_extracted_fields
from leadengine.models import Candidate, UsageEvent
from leadengine.extraction.extractor import Extraction
from leadengine.runner import Runner

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "extraction_golden.json").read_text(encoding="utf-8"))


def test_field_mapping_matches_the_shared_golden_fixture():
    """The TypeScript side asserts the very same cases (modules/lead-extraction/lead-extraction.test.ts)."""
    for case in GOLDEN["cases"]:
        assert to_extracted_fields(case["modelOutput"], case["hints"]) == case["expected"], case["name"]


def test_shared_spec_is_what_the_python_side_actually_uses():
    from leadengine.extraction.prompt import OUTPUT_SCHEMA, SYSTEM_PROMPT
    from leadengine.pricing import OPENAI_USD_PER_MILLION
    from leadengine.shared import SPEC

    assert SYSTEM_PROMPT == SPEC["extraction"]["systemPrompt"]
    assert sorted(OUTPUT_SCHEMA["required"]) == sorted(OUTPUT_SCHEMA["properties"])  # OpenAI strict mode
    assert OPENAI_USD_PER_MILLION["gpt-4o-mini"] == (0.15, 0.6)


class TestMatchSignals:
    criteria = {"signalKeywords": ["retiring", "owner selling", "must sell"]}

    def test_finds_keywords_case_insensitively_across_texts(self):
        assert match_signals(self.criteria, "The owner is RETIRING after 30 years.", "unrelated") == ["retiring"]

    def test_phrases_match_with_flexible_spacing(self):
        assert match_signals(self.criteria, "Motivated: owner   selling due to health.") == ["owner selling"]

    def test_whole_words_only(self):
        assert match_signals({"signalKeywords": ["sell"]}, "Our best-sellers and reselling program") == []

    def test_no_criteria_or_no_text_means_nothing(self):
        assert match_signals(None, "retiring") == []
        assert match_signals({}, "retiring") == []
        assert match_signals(self.criteria, None, "") == []
        assert match_signals({"signalKeywords": ["", "  "]}, "anything") == []

    def test_reports_each_keyword_once_in_profile_order(self):
        assert match_signals(self.criteria, "must sell, must sell, retiring") == ["retiring", "must sell"]


class FakeDb:
    def __init__(self):
        self.leads = {}

    def start_run(self, profile):
        return "run-1"

    def existing_keys(self, tenant_id, source_type, keys):
        return set()

    def insert_lead(self, profile, lead):
        self.leads[lead.dedupe_key] = lead
        return True

    def record_usage(self, *a):
        pass

    def finish_run(self, *a, **kw):
        pass

    def save_profile_state(self, *a):
        pass


class OneCandidate:
    source_type = "google_places"

    def search(self, profile, term, ctx):
        yield [Candidate("google_places", "k1", "Cool Air", text="Family HVAC firm. The owner is retiring next year.")]


class SilentExtractor:
    def extract(self, candidate, text):
        return Extraction({"businessName": "Cool Air", "summary": "HVAC contractor.", "signals": []}, UsageEvent("openai", "extract", 0.0001))


def run(profile):
    db = FakeDb()
    runner = Runner(
        db=db, sources={"google_places": OneCandidate()}, extractor=SilentExtractor(), enricher=None,
        make_context=lambda state, usage: SimpleNamespace(state=state, record_usage=usage),
    )
    runner.run_profile(replace(profile, keywords=[]))
    return db.leads["k1"].extracted_fields


def test_matched_signals_are_stored_on_the_lead_from_the_full_text(profile):
    fields = run(replace(profile, criteria={"signalKeywords": ["retiring", "must sell"]}))
    assert fields["matchedSignals"] == ["retiring"]  # found in the raw text even though the AI's own signals were empty


def test_profiles_without_criteria_add_no_matchedSignals_key(profile):
    assert "matchedSignals" not in run(profile)


def test_run_requested_flag_is_read_and_consumed_by_the_db_layer():
    """SQL-level pins: a 'Run now' makes a profile due, and starting the run consumes the request."""
    import inspect

    from leadengine.db import Database

    assert "run_requested_at is not null" in inspect.getsource(Database.due_profiles)
    start = inspect.getsource(Database.start_run)
    assert "set run_requested_at = null" in start
