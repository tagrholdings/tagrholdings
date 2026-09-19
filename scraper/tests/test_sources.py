import json

import httpx
import pytest

from conftest import make_ctx
from leadengine.sources.base import SourceError, SourceNotConfigured
from leadengine.sources import brave_search
from leadengine.sources.brave_search import BraveSearchSource
from leadengine.sources.google_places import GooglePlacesSource


def places_handler(pages, geocode_calls=None):
    """Serves a geocode response and a sequence of Places pages (each a dict)."""
    served = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if "geocode" in request.url.path:
            if geocode_calls is not None:
                geocode_calls.append(1)
            return httpx.Response(200, json={"status": "OK", "results": [{"geometry": {"location": {"lat": 33.45, "lng": -112.07}}}]})
        body = json.loads(request.content)
        assert request.headers["X-Goog-FieldMask"].startswith("places.id")
        page = pages[served["n"]]
        served["n"] += 1
        if served["n"] > 1:
            assert "pageToken" in body
        return httpx.Response(200, json=page)

    return handler


PLACE_A = {
    "id": "place-a",
    "displayName": {"text": "Cool Air Phoenix"},
    "formattedAddress": "1 Main St, Phoenix, AZ",
    "websiteUri": "https://www.coolair.test/",
    "nationalPhoneNumber": "(602) 555-0100",
    "googleMapsUri": "https://maps.google.com/?cid=1",
    "businessStatus": "OPERATIONAL",
    "types": ["hvac_contractor", "point_of_interest"],
    "rating": 4.8,
    "userRatingCount": 120,
}
PLACE_CLOSED = {**PLACE_A, "id": "place-closed", "businessStatus": "CLOSED_PERMANENTLY"}


def test_places_pages_candidates_and_usage(settings, profile):
    usage = []
    pages = [
        {"places": [PLACE_A, PLACE_CLOSED], "nextPageToken": "tok"},
        {"places": [{**PLACE_A, "id": "place-b", "displayName": {"text": "B Heating"}}]},
    ]
    ctx = make_ctx(settings, places_handler(pages), usage=usage)
    result = list(GooglePlacesSource().search(profile, "HVAC contractors", ctx))

    assert [[c.dedupe_key for c in page] for page in result] == [["place-a"], ["place-b"]]  # closed business dropped
    first = result[0][0]
    assert first.business_name == "Cool Air Phoenix"
    assert first.website == "https://coolair.test"
    assert first.hints["phone"] == "(602) 555-0100"
    # 1 geocode + 2 Places pages, each a billable call.
    assert sorted(e.provider for e in usage) == ["google_geocoding", "google_places", "google_places"]
    assert sum(e.cost_usd for e in usage) == pytest.approx(0.005 + 2 * 0.035)


def test_places_geocode_is_cached_in_state(settings, profile):
    calls = []
    state = {}
    handler = places_handler([{"places": [PLACE_A]}], geocode_calls=calls)
    list(GooglePlacesSource().search(profile, "HVAC", make_ctx(settings, handler, state=state)))
    assert state["geocode"]["lat"] == 33.45

    handler2 = places_handler([{"places": [PLACE_A]}], geocode_calls=calls)
    usage = []
    list(GooglePlacesSource().search(profile, "HVAC", make_ctx(settings, handler2, state=state, usage=usage)))
    assert len(calls) == 1  # second search reused the cache
    assert [e.provider for e in usage] == ["google_places"]


def test_places_http_error_raises_source_error(settings, profile):
    def handler(request):
        if "geocode" in request.url.path:
            return httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []})
        return httpx.Response(403, text="API key not valid")

    with pytest.raises(SourceError, match="403"):
        list(GooglePlacesSource().search(profile, "HVAC", make_ctx(settings, handler)))


def test_places_without_key_is_not_configured(settings, profile):
    from dataclasses import replace

    ctx = make_ctx(replace(settings, google_api_key=None), lambda r: httpx.Response(500))
    with pytest.raises(SourceNotConfigured):
        list(GooglePlacesSource().search(profile, "HVAC", ctx))


def brave_response(results, more=True):
    return {"query": {"original": "q", "more_results_available": more}, "web": {"type": "search", "results": results}}


BRAVE_ITEMS = [
    {
        "title": "Cool Air Phoenix - HVAC Repair",
        "url": "https://www.coolair.test/services",
        "description": "Fast <strong>AC repair</strong> &amp; installation in Phoenix",
    },
    {"title": "Best HVAC - Yelp", "url": "https://www.yelp.com/biz/x", "description": "reviews"},
]


def test_brave_request_shape_filters_aggregators_and_cleans_text(settings, profile):
    usage = []
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = request.url
        seen["token"] = request.headers.get("X-Subscription-Token")
        return httpx.Response(200, json=brave_response(BRAVE_ITEMS, more=False))

    ctx = make_ctx(settings, handler, usage=usage)
    pages = list(BraveSearchSource().search(profile, "hvac", ctx))

    assert seen["url"].host == "api.search.brave.com" and seen["url"].path == "/res/v1/web/search"
    assert seen["url"].params["q"] == "hvac Phoenix AZ"
    assert seen["url"].params["count"] == "20" and seen["url"].params["offset"] == "0"
    assert seen["token"] == "test-brave"  # auth is the X-Subscription-Token header, not a query param
    assert "key" not in seen["url"].params

    assert len(pages) == 1 and len(pages[0]) == 1  # Yelp dropped
    candidate = pages[0][0]
    assert candidate.business_name == "Cool Air Phoenix"
    assert candidate.dedupe_key == "coolair.test"
    assert candidate.website == "https://coolair.test/services"
    assert candidate.source_type == "brave_search"
    assert "Fast AC repair & installation in Phoenix" in candidate.text  # tags stripped, entities decoded
    assert [(e.provider, e.operation) for e in usage] == [("brave_search", "search")]
    assert usage[0].cost_usd == pytest.approx(0.005)


def test_brave_skips_roundup_pages_that_are_not_a_business_site(settings, profile):
    items = [
        {"title": "15 Best Commercial HVAC Contractors Phoenix, AZ", "url": "https://downtobid.test/x", "description": "list"},
        {"title": "Top 10 AC Repair Companies", "url": "https://roundup.test/x", "description": "list"},
        {"title": "HVAC Repair Near Me", "url": "https://near.test/x", "description": "list"},
        {"title": "Howard Air & Plumbing", "url": "https://howardair.test", "description": "real business"},
    ]
    handler = lambda r: httpx.Response(200, json=brave_response(items, more=False))
    pages = list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, handler)))
    assert [c.business_name for c in pages[0]] == ["Howard Air & Plumbing"]


def test_brave_pages_by_page_index_and_stops_when_no_more_results(settings, profile):
    offsets = []

    def handler(request: httpx.Request) -> httpx.Response:
        offsets.append(request.url.params["offset"])
        item = {"title": f"Biz {len(offsets)}", "url": f"https://biz{len(offsets)}.test", "description": "x"}
        return httpx.Response(200, json=brave_response([item], more=len(offsets) < 2))

    usage = []
    pages = list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, handler, usage=usage)))
    assert offsets == ["0", "1"]  # offset is a page index; stopped because more_results_available went false
    assert len(pages) == 2 and len(usage) == 2  # each accepted request billed once


def test_brave_empty_results_stop_without_yielding(settings, profile):
    handler = lambda r: httpx.Response(200, json={"query": {"more_results_available": True}})  # no "web" key at all
    usage = []
    assert list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, handler, usage=usage))) == []
    assert len(usage) == 1  # the request itself was accepted, so it is on the bill


def test_brave_429_retries_once_then_succeeds_and_bills_only_the_success(settings, profile, monkeypatch):
    waits = []
    monkeypatch.setattr(brave_search, "_sleep", waits.append)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "2"})
        return httpx.Response(200, json=brave_response(BRAVE_ITEMS[:1], more=False))

    usage = []
    pages = list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, handler, usage=usage)))
    assert waits == [2.0] and len(pages) == 1
    assert len(usage) == 1  # the rate-limited attempt cost nothing


def test_brave_persistent_429_raises_source_error(settings, profile, monkeypatch):
    monkeypatch.setattr(brave_search, "_sleep", lambda _s: None)
    with pytest.raises(SourceError, match="429"):
        list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, lambda r: httpx.Response(429))))


def test_brave_rejected_key_has_actionable_error_and_no_spend(settings, profile):
    usage = []
    with pytest.raises(SourceError, match="BRAVE_API_KEY"):
        list(BraveSearchSource().search(profile, "hvac", make_ctx(settings, lambda r: httpx.Response(401, text="bad"), usage=usage)))
    assert usage == []


def test_brave_without_key_is_not_configured(settings, profile):
    from dataclasses import replace

    ctx = make_ctx(replace(settings, brave_api_key=None), lambda r: httpx.Response(500))
    with pytest.raises(SourceNotConfigured, match="BRAVE_API_KEY"):
        list(BraveSearchSource().search(profile, "hvac", ctx))


def test_places_denied_geocode_is_not_billed_and_search_still_runs(settings, profile):
    usage = []

    def handler(request):
        if "geocode" in request.url.path:
            return httpx.Response(200, json={"status": "REQUEST_DENIED", "error_message": "This API is not activated"})
        body = json.loads(request.content)
        assert "locationBias" not in body  # no center -> no bias, but the search proceeds
        return httpx.Response(200, json={"places": [PLACE_A]})

    pages = list(GooglePlacesSource().search(profile, "HVAC", make_ctx(settings, handler, usage=usage)))
    assert len(pages) == 1
    assert [e.provider for e in usage] == ["google_places"]  # the rejected geocode cost nothing


def test_places_website_tracking_params_are_stripped(settings, profile):
    tracked = {**PLACE_A, "websiteUri": "https://www.coolair.test/?utm_source=google&utm_medium=gmb"}
    handler = places_handler([{"places": [tracked]}])
    pages = list(GooglePlacesSource().search(profile, "HVAC", make_ctx(settings, handler)))
    candidate = pages[0][0]
    assert candidate.website == "https://coolair.test"
    assert "utm_" not in candidate.text
