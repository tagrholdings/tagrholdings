from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace

from leadengine.extraction.extractor import Extraction
from leadengine.models import Candidate, RawLead, UsageEvent
from leadengine.runner import Runner
from leadengine.sources.base import SourceError, SourceNotConfigured


class FakeDb:
    def __init__(self):
        self.leads: dict[tuple[str, str], RawLead] = {}
        self.usage: list[UsageEvent] = []
        self.finished: dict | None = None
        self.saved: tuple[dict, bool] | None = None

    def start_run(self, profile):
        return "run-1"

    def existing_keys(self, tenant_id, source_type, keys):
        return {k for k in keys if (source_type, k) in self.leads}

    def insert_lead(self, profile, lead):
        key = (lead.source_type, lead.dedupe_key)
        if key in self.leads:
            return False
        self.leads[key] = lead
        return True

    def record_usage(self, tenant_id, run_id, event):
        self.usage.append(event)

    def finish_run(self, tenant_id, run_id, status, seen, added, error, email_sources_detected=0):
        self.finished = {
            "status": status, "seen": seen, "added": added, "error": error, "email_sources_detected": email_sources_detected,
        }

    def save_profile_state(self, profile, run_state, mark_ran):
        self.saved = (run_state, mark_ran)


def cand(key: str, source="google_places") -> Candidate:
    return Candidate(source_type=source, dedupe_key=key, business_name=f"Biz {key}", text=f"text {key}")


class ScriptedSource:
    """Yields the given pages for any term; optionally raises after them."""

    def __init__(self, source_type, pages, error=None):
        self.source_type = source_type
        self.pages = pages
        self.error = error
        self.searched: list[str] = []

    def search(self, profile, term, ctx):
        self.searched.append(term)
        for page in self.pages:
            yield page
        if self.error:
            raise self.error


class CountingExtractor:
    def __init__(self):
        self.calls = 0

    def extract(self, candidate, text):
        self.calls += 1
        return Extraction(
            {"businessName": candidate.business_name},
            UsageEvent(provider="openai", operation="extract", model="gpt-4o-mini", cost_usd=0.0003, input_tokens=100, output_tokens=20),
        )


def make_runner(db, sources, extractor=None, deadline=None, clock=None, max_leads=None):
    def make_context(state, record_usage):
        return SimpleNamespace(state=state, record_usage=record_usage)

    return Runner(
        db=db,
        sources={s.source_type: s for s in sources},
        extractor=extractor,
        enricher=None,
        make_context=make_context,
        deadline=deadline,
        max_leads_override=max_leads,
        clock=clock or (lambda: 0.0),
    )


def one_term(profile):
    return replace(profile, keywords=[])


def test_adds_new_leads_and_records_extraction_usage(profile):
    db, extractor = FakeDb(), CountingExtractor()
    source = ScriptedSource("google_places", [[cand("a"), cand("b")]])
    result = make_runner(db, [source], extractor).run_profile(one_term(profile))

    assert (result.status, result.candidates_seen, result.leads_added) == ("completed", 2, 2)
    assert extractor.calls == 2
    assert len(db.usage) == 2 and all(u.provider == "openai" for u in db.usage)
    assert db.finished["added"] == 2
    state, mark_ran = db.saved
    assert mark_ran is True and "cursor" not in state and state["resume"] is False


def test_known_leads_are_skipped_without_paying_for_extraction(profile):
    db, extractor = FakeDb(), CountingExtractor()
    db.leads[("google_places", "a")] = RawLead("google_places", "a", "Biz a", None, "", {})
    source = ScriptedSource("google_places", [[cand("a"), cand("b")]])
    result = make_runner(db, [source], extractor).run_profile(one_term(profile))

    assert (result.candidates_seen, result.leads_added) == (2, 1)
    assert extractor.calls == 1  # only the new one hit the AI


def test_cap_stops_run_keeps_cursor_and_stamps_last_run(profile):
    db, extractor = FakeDb(), CountingExtractor()
    source = ScriptedSource("google_places", [[cand("a"), cand("b"), cand("c")]])
    result = make_runner(db, [source], extractor, max_leads=2).run_profile(one_term(profile))

    assert result.stop_reason == "cap" and result.leads_added == 2
    assert extractor.calls == 2  # never paid for the third
    state, mark_ran = db.saved
    assert mark_ran is True  # period's work is done: waits frequency_hours
    assert state["cursor"] == {"source": "google_places", "term": "HVAC contractors"}
    assert state["resume"] is False


def test_deadline_marks_partial_and_resume_without_stamping_last_run(profile):
    db = FakeDb()
    ticks = iter([0, 0, 100, 100, 100, 100])  # deadline is 50 -> first clock read passes, later ones don't
    source = ScriptedSource("google_places", [[cand("a")], [cand("b")]])
    runner = make_runner(db, [source], CountingExtractor(), deadline=50, clock=lambda: next(ticks, 100))
    result = runner.run_profile(one_term(profile))

    assert result.status == "partial" and result.stop_reason == "deadline"
    state, mark_ran = db.saved
    assert mark_ran is False and state["resume"] is True and state["cursor"]["source"] == "google_places"


def test_resumes_from_cursor(profile):
    db = FakeDb()
    both = replace(profile, keywords=["air conditioning repair"])
    both.run_state = {"cursor": {"source": "google_places", "term": "air conditioning repair"}, "resume": True}
    source = ScriptedSource("google_places", [[cand("z")]])
    make_runner(db, [source], CountingExtractor()).run_profile(both)
    assert source.searched == ["air conditioning repair"]  # the first term was already done


def test_source_error_is_recorded_and_other_sources_still_run(profile):
    db = FakeDb()
    both = replace(profile, keywords=[], sources={**profile.sources, "brave_search": True})
    broken = ScriptedSource("google_places", [], error=SourceError("boom"))
    working = ScriptedSource("brave_search", [[cand("w", "brave_search")]])
    result = make_runner(db, [broken, working], CountingExtractor()).run_profile(both)

    assert result.status == "partial" and result.leads_added == 1
    assert "boom" in db.finished["error"]


def test_missing_credentials_are_reported_not_fatal(profile):
    db = FakeDb()
    source = ScriptedSource("google_places", [], error=SourceNotConfigured("GOOGLE_CLOUD_API_KEY is not set."))
    result = make_runner(db, [source]).run_profile(replace(profile, keywords=["a", "b"]))
    assert result.status == "partial"
    assert db.finished["error"].count("GOOGLE_CLOUD_API_KEY") == 1  # not repeated per term


def test_extractor_failure_keeps_the_lead(profile):
    class Boom:
        def extract(self, candidate, text):
            raise RuntimeError("openai down")

    db = FakeDb()
    source = ScriptedSource("google_places", [[cand("a")]])
    result = make_runner(db, [source], Boom()).run_profile(one_term(profile))
    assert result.leads_added == 1
    assert db.leads[("google_places", "a")].extracted_fields["businessName"] == "Biz a"
    assert db.usage == []  # nothing billed for a call that never returned


def test_broker_listings_is_one_plan_step_however_many_industries_the_profile_has(profile):
    p = replace(profile, category="HVAC", keywords=["plumbing", "pest control"], sources={"broker_listings": True, "google_places": True})
    plan = Runner.plan(p)
    assert [s for s in plan if s[0] == "broker_listings"] == [("broker_listings", "*")]
    assert [t for s, t in plan if s == "google_places"] == ["HVAC", "plumbing", "pest control"]


def test_prefilled_candidates_are_saved_as_extracted_without_calling_the_ai(profile):
    listing = Candidate(
        source_type="broker_listings", dedupe_key="url:https://b.test/l/1", business_name="HVAC Co", source_url="https://b.test/l/1",
        text="Asking $1M\nListed by Broker", fields={"businessName": "HVAC Co", "askingPrice": "$1M", "signals": []},
    )
    db, extractor = FakeDb(), CountingExtractor()
    source = ScriptedSource("broker_listings", [[listing]])
    p = replace(profile, sources={"broker_listings": True})
    result = make_runner(db, [source], extractor).run_profile(p)

    assert (result.candidates_seen, result.leads_added) == (1, 1)
    assert extractor.calls == 0 and db.usage == []
    saved = db.leads[("broker_listings", "url:https://b.test/l/1")]
    assert saved.extracted_fields["askingPrice"] == "$1M" and saved.source_url == "https://b.test/l/1"
    assert source.searched == ["*"]
