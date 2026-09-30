from __future__ import annotations

import httpx
import pytest

from conftest import make_ctx
from leadengine.models import ListingSite
from leadengine.sources.broker_listings import BrokerListingsSource, CrawlResult
from leadengine.extraction.listings import ExtractedListing
from leadengine.util.geo import LOCAL, OUTSIDE, REGION, STATE, UNKNOWN, Geo, keeps, state_code

COORDS = {  # (lat, lng)
    "phoenix, az": (33.4484, -112.0740),
    "mesa, az": (33.4152, -111.8315),
    "tucson, az": (32.2226, -110.9747),
    "nowhereville, az": None,
}


def geocode_handler(calls):
    def handler(request: httpx.Request) -> httpx.Response:
        address = request.url.params["address"].lower()
        calls.append(address)
        point = COORDS.get(address)
        if point is None:
            return httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []})
        return httpx.Response(200, json={"status": "OK", "results": [{"geometry": {"location": {"lat": point[0], "lng": point[1]}}}]})

    return handler


def make_geo(settings, calls=None, usage=None, radius=25):
    ctx = make_ctx(settings, geocode_handler(calls if calls is not None else []), usage=usage)
    return Geo(ctx, "Phoenix", "AZ", radius), ctx


def test_state_code_reads_codes_names_and_city_state_pairs():
    assert state_code("AZ") == "AZ" and state_code("az") == "AZ" and state_code("Arizona") == "AZ"
    assert state_code("Phoenix, AZ") == "AZ" and state_code("New York") == "NY" and state_code("West Virginia") == "WV"
    assert state_code("") is None and state_code(None) is None and state_code("Narnia") is None


def test_classify_tiers(settings):
    geo, _ = make_geo(settings)
    assert geo.classify({"city": "Phoenix", "state": "Arizona"}) == LOCAL
    assert geo.classify({"city": "Mesa", "state": "AZ"}) == LOCAL  # ~15 miles: Phoenix for a buyer
    assert geo.classify({"city": "Tucson", "state": "AZ"}) == STATE  # ~107 miles
    assert geo.classify({"city": "Phoenix Metro", "state": "AZ"}) == LOCAL  # starts with the profile's city
    assert geo.classify({"city": "Maricopa County", "state": "AZ"}) == REGION
    assert geo.classify({"city": None, "state": "Arizona"}) == REGION
    assert geo.classify({"city": "Nowhereville", "state": "AZ"}) == REGION  # Google can't place it
    assert geo.classify({"city": None, "state": None}) == UNKNOWN
    assert geo.classify(None) == UNKNOWN
    assert geo.classify({"city": "Albany", "state": "New York"}) == OUTSIDE
    assert geo.classify({"city": "Toronto", "state": "Canada"}) == OUTSIDE


def test_radius_decides_local_vs_state(settings):
    geo, _ = make_geo(settings, radius=150)
    assert geo.classify({"city": "Tucson", "state": "AZ"}) == LOCAL


def test_geocodes_are_cached_billed_once_and_only_for_the_profiles_state(settings):
    calls, usage = [], []
    geo, ctx = make_geo(settings, calls, usage)
    for _ in range(3):
        geo.classify({"city": "Mesa", "state": "AZ"})
    geo.classify({"city": "Albany", "state": "NY"})
    assert calls == ["phoenix, az", "mesa, az"]
    assert len(usage) == 2 and all(u.provider == "google_geocoding" for u in usage)
    assert "mesa, az" in ctx.state["geo_cache"]  # persisted in run_state by the runner


def test_without_a_google_key_a_city_is_local_only_by_name(settings):
    from dataclasses import replace

    ctx = make_ctx(replace(settings, google_api_key=None), lambda r: httpx.Response(500))
    geo = Geo(ctx, "Phoenix", "AZ", 25)
    assert geo.classify({"city": "Phoenix", "state": "AZ"}) == LOCAL
    assert geo.classify({"city": "Tucson", "state": "AZ"}) == REGION
    assert geo.classify({"city": "Albany", "state": "NY"}) == OUTSIDE


@pytest.mark.parametrize(
    "scope,tier,expected",
    [
        ("radius", LOCAL, True), ("radius", REGION, True), ("radius", UNKNOWN, True), ("radius", STATE, False), ("radius", OUTSIDE, False),
        ("state", STATE, True), ("state", OUTSIDE, False),
        ("anywhere", OUTSIDE, True),
    ],
)
def test_scope_decides_what_is_kept(scope, tier, expected):
    assert keeps(scope, tier) is expected


def test_broker_candidates_drop_out_of_scope_listings_and_tag_the_rest(settings, profile):
    geo, _ = make_geo(settings)

    def listing(name, city, state):
        return ExtractedListing({"businessName": name, "location": {"city": city, "state": state}}, f"https://broker.test/l/{name}")

    result = CrawlResult("ok", listings=[
        (listing("a", "Mesa", "AZ"), "p"), (listing("b", "Tucson", "AZ"), "p"), (listing("c", "Albany", "NY"), "p"), (listing("d", None, None), "p"),
    ])
    site = ListingSite(id="s", tenant_id="t", site_name="B", domain="broker.test", site_url="https://broker.test/")
    source = BrokerListingsSource(None)

    kept = source._candidates(result, site, profile, geo)
    assert {c.business_name: c.fields["locationMatch"] for c in kept} == {"a": "local", "d": "unknown"}

    profile.location_scope = "state"
    assert {c.business_name for c in source._candidates(result, site, profile, geo)} == {"a", "b", "d"}
    profile.location_scope = "anywhere"
    assert len(source._candidates(result, site, profile, geo)) == 4
