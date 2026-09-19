from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from conftest import make_ctx
from leadengine.extraction.listings import ExtractedListing, ListingsExtraction, OpenAIListingsExtractor, parse_listings
from leadengine.models import SOURCE_BROKER_LISTINGS, ListingSite, UsageEvent
from leadengine.sources.base import SourceNotConfigured
from leadengine.sources.broker_listings import BrokerListingsSource, listing_signature
from leadengine.util import pages as P
from leadengine.util.urls import clean_listing_url, listing_key


@pytest.fixture(autouse=True)
def _public_urls(monkeypatch):
    # Test hosts don't resolve; the SSRF check has its own tests in test_urls_robots.
    monkeypatch.setattr("leadengine.util.fetch.is_public_http_url", lambda url: True)


# -- util/pages.py ---------------------------------------------------------------------------------------------------


def test_industry_pattern_knows_the_four_target_industries_and_their_synonyms():
    pattern = P.industry_pattern(["HVAC", "Plumbing", "Pest Control", "Property Management"])
    for text in ["Heating & Air Conditioning Co.", "Drain and Sewer Service", "Termite and pest company", "Rental Management Firm", "HVAC"]:
        assert pattern.search(text), text
    assert not pattern.search("Pizza restaurant")


def test_industry_pattern_uses_unknown_terms_literally_and_none_when_empty():
    assert P.industry_pattern(["roofing"]).search("Roofing contractor")
    assert P.industry_pattern(["  "]) is None
    assert P.industry_pattern([]) is None


def test_page_text_keeps_links_inline_and_drops_scripts():
    html = '<html><script>evil()</script><body><h1>Biz</h1><a href="/listings/1">HVAC Co</a></body></html>'
    text = P.page_text_with_links(html, "https://broker.test/x", 1000)
    assert "HVAC Co (https://broker.test/listings/1)" in text and "evil" not in text


def test_content_hash_ignores_whitespace_and_case():
    assert P.content_hash("A  b\nc") == P.content_hash("a b c")
    assert P.content_hash("a") != P.content_hash("b")


HOME = """
<a href="/services/sell-your-business">Sell your business</a>
<a href="/contact-form">Contact</a>
<a href="/businesses-for-sale">Businesses for sale</a>
<a href="/recently-sold-listings">Recently sold listings</a>
<a href="https://other.test/listings">Other site listings</a>
<a href="/buy-a-business">Buy a business</a>
"""


def test_find_listing_pages_skips_sell_contact_sold_and_other_sites():
    found = P.find_listing_pages(HOME, "https://broker.test/")
    assert set(found) == {"https://broker.test/businesses-for-sale", "https://broker.test/buy-a-business"}


def test_find_industry_pages_uses_the_link_text_or_path():
    html = '<a href="/hvac-businesses">HVAC</a><a href="/x/plumbing-contractors">Trades</a><a href="/sell-hvac">Sell HVAC</a>'
    found = P.find_industry_pages(html, "https://b.test/", P.industry_pattern(["hvac", "plumbing"]))
    assert found == ["https://b.test/hvac-businesses", "https://b.test/x/plumbing-contractors"]
    assert P.find_industry_pages(html, "https://b.test/", None) == []


def test_find_next_page_prefers_next_links_and_ignores_contact_pages():
    assert P.find_next_page('<a href="/l?page=2" rel="next">2</a>', "https://b.test/l") == "https://b.test/l?page=2"
    assert P.find_next_page('<a href="/l/p2">Next »</a>', "https://b.test/l") == "https://b.test/l/p2"
    assert P.find_next_page('<a href="/contact-form">Contact</a>', "https://b.test/l") is None


def test_find_next_page_follows_numbered_links_only_to_the_following_number():
    html = '<a href="/l?page=2">2</a><a href="/l?page=3">3</a><a href="/l?page=9">9</a>'
    assert P.find_next_page(html, "https://b.test/l", "https://b.test/l") == "https://b.test/l?page=2"
    assert P.find_next_page(html, "https://b.test/l?page=2", "https://b.test/l?page=2") == "https://b.test/l?page=3"
    assert P.find_next_page(html, "https://b.test/l?page=3", "https://b.test/l?page=3") is None  # 4 doesn't exist: no jump to 9


SEARCH_FORM = """
<form action="/search" method="get">
  <input type="hidden" name="post_type" value="listing"><input type="search" name="s" placeholder="Search">
  <select name="state"><option value="">Any</option><option value="AZ" selected>AZ</option></select>
</form>
"""


def test_find_search_urls_builds_one_get_url_per_term_from_a_plain_search_form():
    urls = P.find_search_urls(SEARCH_FORM, "https://b.test/", ["plumbing", "pest control"])
    assert urls == [
        "https://b.test/search?post_type=listing&state=AZ&s=plumbing",
        "https://b.test/search?post_type=listing&state=AZ&s=pest+control",
    ]


@pytest.mark.parametrize(
    "form",
    [
        '<form method="post" action="/s"><input name="s"></form>',  # not GET
        '<form action="/s"><input name="s"><input type="email" name="e"></form>',  # newsletter/lead form
        '<form action="/s"><input type="password" name="p"><input name="q"></form>',  # login
        '<form action="https://elsewhere.test/s"><input name="s"></form>',  # other site
        '<form action="/s"><input name="firstname"></form>',  # not a keyword box
    ],
)
def test_find_search_urls_ignores_forms_that_are_not_a_read_only_keyword_search(form):
    assert P.find_search_urls(form, "https://b.test/", ["hvac"]) == []


# -- util/urls.py ----------------------------------------------------------------------------------------------------


def test_clean_listing_url_drops_tracking_but_keeps_the_listing_id():
    assert clean_listing_url("https://b.test/l?id=42&utm_source=x&swpmtx=abc&swpmtxnonce=def#top") == "https://b.test/l?id=42"
    assert clean_listing_url("https://b.test/l/1?swpmtx=abc") == "https://b.test/l/1"


def test_listing_key_separates_listings_that_differ_only_by_query():
    assert listing_key("https://www.b.test/d.aspx?id=1&utm_x=1") != listing_key("https://b.test/d.aspx?id=2")
    assert listing_key("https://www.b.test/d.aspx?id=1&utm_x=1") == listing_key("https://b.test/d.aspx?utm_y=2&id=1")
    assert listing_key("https://b.test/listings/1/") == "https://b.test/listings/1"


# -- extraction/listings.py ------------------------------------------------------------------------------------------


def test_parse_listings_verifies_urls_against_the_source_text_and_drops_empty_items():
    text = "HVAC Co (https://b.test/l/1)"
    parsed = {
        "listings": [
            {"business_name": "HVAC Co", "listing_url": "https://b.test/l/1", "city": "null", "state": "AZ"},
            {"business_name": "Made Up", "listing_url": "https://b.test/invented"},
            {"business_name": None, "listing_url": None, "industry": "x"},
        ]
    }
    listings = parse_listings(parsed, text)
    assert [(l.fields["businessName"], l.listing_url) for l in listings] == [("HVAC Co", "https://b.test/l/1"), ("Made Up", None)]
    assert listings[0].fields["location"]["city"] is None  # the text "null" is not a city
    assert listings[0].fields["location"]["state"] == "AZ"


class _FakeCompletions:
    def __init__(self, content):
        self.content, self.kwargs = content, None

    def create(self, **kwargs):
        self.kwargs = kwargs
        message = type("M", (), {"content": self.content})()
        usage = type("U", (), {"prompt_tokens": 1000, "completion_tokens": 200})()
        return type("R", (), {"choices": [type("C", (), {"message": message})()], "usage": usage, "model": "gpt-4o-mini"})()


def _extractor(settings, content):
    completions = _FakeCompletions(content)
    client = type("Client", (), {"chat": type("Chat", (), {"completions": completions})()})()
    return OpenAIListingsExtractor(settings, client=client), completions


def test_extractor_returns_listings_and_a_billable_usage_event(settings):
    extractor, completions = _extractor(settings, '{"listings":[{"business_name":"HVAC Co","listing_url":null}]}')
    result = extractor.extract("page text")
    assert [l.fields["businessName"] for l in result.listings] == ["HVAC Co"]
    assert result.usage and result.usage.input_tokens == 1000 and not result.failed
    assert completions.kwargs["response_format"]["json_schema"]["strict"] is True


def test_extractor_marks_unusable_output_as_failed_but_still_billed(settings):
    extractor, _ = _extractor(settings, '{"listings":[{"business_na')  # truncated
    result = extractor.extract("page text")
    assert result.failed and result.usage is not None and result.listings == []


# -- listing_signature -----------------------------------------------------------------------------------------------


def test_listing_signature_matches_the_app_rule_and_falls_back_to_the_link():
    a = {"businessName": "HVAC Co", "location": {"city": "Phoenix", "state": "AZ"}, "askingPrice": "$1M"}
    assert listing_signature(a, None) == listing_signature({**a, "businessName": " hvac co "}, "https://x.test/1")
    assert listing_signature({"businessName": None}, "https://x.test/1?utm=1") == listing_signature({}, "https://x.test/1")
    assert listing_signature({}, None) is None


# -- BrokerListingsSource ------------------------------------------------------------------------------------------------

LISTING_PAGE = "<html><body><h1>Listings</h1>" + "<p>Some filler text to make the page long enough. </p>" * 20 + "</body></html>"


class FakeExtractor:
    """Returns the same listings for every page; counts calls."""

    def __init__(self, listings=None, failed=False):
        self.listings = listings if listings is not None else []
        self.failed = failed
        self.calls = 0

    def extract(self, text, source_type="broker_website"):
        self.calls += 1
        usage = UsageEvent(provider="openai", operation="extract", model="gpt-4o-mini", cost_usd=0.001, input_tokens=10, output_tokens=5)
        return ListingsExtraction(listings=list(self.listings), usage=usage, failed=self.failed)


def L(name, url=None, industry=None, price="$1M", city="Phoenix"):
    return ExtractedListing(
        {"businessName": name, "industry": industry, "askingPrice": price, "summary": None, "location": {"city": city, "state": "AZ"}}, url
    )


class FakeStore:
    def __init__(self, sites=None, known=()):
        self.sites = sites or []
        self.known = set(known)
        self.added: list[tuple] = []
        self.recorded: list[tuple] = []

    def listing_sites_for_crawl(self, tenant_id):
        return self.sites

    def known_site_domains(self, tenant_id):
        return set(self.known)

    def add_discovered_site(self, tenant_id, name, domain, url):
        self.added.append((name, domain, url))
        return True

    def record_site_crawl(self, tenant_id, site_id, status, detail, count, listings_url, hashes):
        self.recorded.append((site_id, status, detail, count, listings_url, hashes))


def broker_site(**kw):
    base = dict(id="s1", tenant_id="t", site_name="Broker", domain="broker.test", site_url="https://broker.test/")
    return ListingSite(**{**base, **kw})


def site_handler(pages, status_for=None):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.raw_path.decode()
        if path == "/robots.txt":
            return httpx.Response(404)
        if status_for and path in status_for:
            return httpx.Response(status_for[path])
        body = pages.get(path)
        if body is None:
            return httpx.Response(404)
        return httpx.Response(200, headers={"content-type": "text/html"}, text=body)

    return handler


HOME_PAGE = '<html><body><a href="/businesses-for-sale">Businesses for sale</a></body></html>'


def crawl(source, site, profile, ctx):
    pattern = P.industry_pattern(profile.terms)
    result = source._crawl(site, profile, ctx, pattern)
    return result, source._candidates(result, site, profile)


def test_crawl_keeps_only_listings_in_the_profile_industries(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}))
    extractor = FakeExtractor([L("Phoenix HVAC Service", "https://broker.test/l/1"), L("Pizza Restaurant", "https://broker.test/l/2")])
    profile = profile.__class__(**{**profile.__dict__, "category": "HVAC", "keywords": ["plumbing"]})
    result, cands = crawl(BrokerListingsSource(extractor), broker_site(), profile, ctx)

    assert result.status == "ok" and result.listings_url == "https://broker.test/businesses-for-sale"
    assert [c.business_name for c in cands] == ["Phoenix HVAC Service"]
    assert cands[0].dedupe_key == "url:https://broker.test/l/1"
    assert cands[0].source_type == SOURCE_BROKER_LISTINGS and cands[0].fields["broker"] == "Broker"
    assert cands[0].fields["listingSignature"]


def test_candidates_strip_session_tokens_skip_sold_and_keep_id_only_links_apart(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}))
    extractor = FakeExtractor(
        [
            L("HVAC A", "https://broker.test/d.aspx?id=1&swpmtx=zzz&utm_source=x", "HVAC"),
            L("HVAC B", "https://broker.test/d.aspx?id=2", "HVAC"),
            L("HVAC Old - Sold", "https://broker.test/l/3", "HVAC"),
            L("HVAC C", "https://broker.test/projects/sold-hvac-company", "HVAC"),
            L("HVAC A again", "https://broker.test/d.aspx?id=1", "HVAC"),
        ]
    )
    _, cands = crawl(BrokerListingsSource(extractor), broker_site(), profile.__class__(**{**profile.__dict__, "keywords": ["hvac"]}), ctx)
    assert [c.source_url for c in cands] == ["https://broker.test/d.aspx?id=1", "https://broker.test/d.aspx?id=2"]
    assert len({c.dedupe_key for c in cands}) == 2


def test_crawl_without_a_listing_link_uses_the_page_as_source_and_a_signature_key(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}))
    _, cands = crawl(BrokerListingsSource(FakeExtractor([L("HVAC Co", None, "HVAC")])), broker_site(), profile, ctx)
    assert cands[0].source_url == "https://broker.test/businesses-for-sale" and cands[0].dedupe_key.startswith("sig:")


def test_crawl_follows_industry_category_pages_and_keeps_all_their_listings(settings, profile):
    home = '<a href="/buy-a-business">Buy a business</a>'
    main = LISTING_PAGE + '<a href="/category/plumbing-contractors">Plumbing</a>'
    ctx = make_ctx(settings, site_handler({"/": home, "/buy-a-business": main, "/category/plumbing-contractors": LISTING_PAGE + " "}))
    calls = {"n": 0}

    class PerPage(FakeExtractor):
        def extract(self, text, source_type="broker_website"):
            calls["n"] += 1
            return super().extract(text, source_type)

    # The category page's listings don't mention the industry in their text, yet belong to it.
    extractor = PerPage([L("Family Business", "https://broker.test/l/9", None)])
    _, cands = crawl(BrokerListingsSource(extractor), broker_site(), profile.__class__(**{**profile.__dict__, "keywords": ["plumbing"], "category": "plumbing"}), ctx)
    assert calls["n"] == 2
    assert [c.business_name for c in cands] == ["Family Business"]


def test_crawl_uses_the_sites_own_keyword_search_once_but_still_filters_its_results(settings, profile):
    home = '<a href="/buy-a-business">Buy</a>'
    main = LISTING_PAGE + SEARCH_FORM
    searched: list[str] = []

    def handler(request):
        if request.url.path == "/search":
            searched.append(request.url.query.decode())
        return site_handler({"/": home, "/buy-a-business": main, "/search": LISTING_PAGE})(request)

    ctx = make_ctx(settings, handler)
    prof = profile.__class__(**{**profile.__dict__, "keywords": ["plumbing", "pest control"], "category": "hvac"})
    extractor = FakeExtractor([L("Bakery", "https://broker.test/l/1", None)])
    _, cands = crawl(BrokerListingsSource(extractor), broker_site(), prof, ctx)
    assert len(searched) == 3  # hvac, plumbing, pest control — one results page each
    assert cands == []  # a search that ignored the keyword and returned a bakery does not sneak in


def test_crawl_status_no_listings_when_the_homepage_has_no_listings_link(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": "<a href='/about'>About</a>"}))
    result, cands = crawl(BrokerListingsSource(FakeExtractor()), broker_site(), profile, ctx)
    assert (result.status, cands) == ("no_listings", [])


@pytest.mark.parametrize("code", [401, 403, 429])
def test_crawl_marks_a_site_that_refuses_us_as_blocked_and_never_retries_around_it(settings, profile, code):
    seen: list[str] = []

    def handler(request):
        seen.append(request.url.path)
        return httpx.Response(code) if request.url.path != "/robots.txt" else httpx.Response(404)

    result, _ = crawl(BrokerListingsSource(FakeExtractor()), broker_site(), profile, make_ctx(settings, handler))
    assert result.status == "blocked" and str(code) in (result.detail or "")
    assert seen.count("/") == 1


def test_crawl_blocked_by_robots_txt(settings, profile):
    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /")
        return httpx.Response(200, headers={"content-type": "text/html"}, text=HOME_PAGE)

    result, _ = crawl(BrokerListingsSource(FakeExtractor()), broker_site(), profile, make_ctx(settings, handler))
    assert result.status == "blocked" and "robots" in (result.detail or "")


def test_crawl_marks_unreachable_sites_as_error(settings, profile):
    result, _ = crawl(BrokerListingsSource(FakeExtractor()), broker_site(), profile, make_ctx(settings, site_handler({}, status_for={"/": 500})))
    assert result.status == "error"


def test_unchanged_pages_cost_no_ai_call(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}))
    extractor = FakeExtractor([L("HVAC Co", "https://broker.test/l/1", "HVAC")])
    source = BrokerListingsSource(extractor)
    first, _ = crawl(source, broker_site(), profile, ctx)
    assert extractor.calls == 1 and first.hashes

    second, cands = crawl(source, broker_site(content_hashes=first.hashes), profile, ctx)
    assert extractor.calls == 1  # not called again
    assert second.status == "ok" and second.unchanged_pages == 1 and cands == []


def test_a_failed_ai_read_is_not_hashed_so_the_page_is_read_again(settings, profile):
    ctx = make_ctx(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}))
    result, _ = crawl(BrokerListingsSource(FakeExtractor(failed=True)), broker_site(), profile, ctx)
    assert result.hashes == {} and result.status == "no_listings"


def test_fetch_budget_per_site_is_respected(settings, profile):
    pages = {"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE + '<a href="/l?page=2" rel="next">n</a>'}
    for n in range(2, 60):
        pages[f"/l?page={n}"] = LISTING_PAGE + f'<a href="/l?page={n + 1}" rel="next">n</a> page {n}'
    requested: list[str] = []

    def handler(request):
        requested.append(request.url.raw_path.decode())
        return site_handler(pages)(request)

    crawl(BrokerListingsSource(FakeExtractor([L("x", "https://broker.test/l/1", "HVAC")])), broker_site(), profile, make_ctx(settings, handler))
    from leadengine.sources.broker_listings import MAX_FETCHES_PER_SITE

    assert len([p for p in requested if p != "/robots.txt"]) <= MAX_FETCHES_PER_SITE


# -- search(): store integration ------------------------------------------------------------------------------------------


def _ctx_with_store(settings, handler, store, state=None):
    ctx = make_ctx(settings, handler, state=state)
    ctx.store = store
    return ctx


def test_search_yields_candidates_then_records_the_crawl_only_after_they_were_handled(settings, profile):
    store = FakeStore([broker_site()])
    settings = settings.__class__(**{**settings.__dict__, "brave_api_key": None})
    ctx = _ctx_with_store(settings, site_handler({"/": HOME_PAGE, "/businesses-for-sale": LISTING_PAGE}), store)
    source = BrokerListingsSource(FakeExtractor([L("HVAC Co", "https://broker.test/l/1", "HVAC")]))

    iterator = source.search(profile, "*", ctx)
    batch = next(iterator)
    assert [c.business_name for c in batch] == ["HVAC Co"]
    assert store.recorded == []  # the runner hasn't consumed the batch yet
    assert list(iterator) == []
    (site_id, status, _detail, count, listings_url, hashes) = store.recorded[0]
    assert (site_id, status, count, listings_url) == ("s1", "ok", 1, "https://broker.test/businesses-for-sale") and hashes


def test_search_records_blocked_sites_without_yielding(settings, profile):
    store = FakeStore([broker_site()])
    settings = settings.__class__(**{**settings.__dict__, "brave_api_key": None})
    ctx = _ctx_with_store(settings, site_handler({}, status_for={"/": 403}), store)
    assert list(BrokerListingsSource(FakeExtractor()).search(profile, "*", ctx)) == []
    assert store.recorded[0][1] == "blocked"


def test_search_requires_the_store_and_the_ai_step(settings, profile):
    with pytest.raises(SourceNotConfigured):
        list(BrokerListingsSource(FakeExtractor()).search(profile, "*", make_ctx(settings, site_handler({}))))
    with pytest.raises(SourceNotConfigured):
        list(BrokerListingsSource(None).search(profile, "*", _ctx_with_store(settings, site_handler({}), FakeStore())))


def test_due_sites_wait_out_the_retry_window_for_blocked_empty_and_broken_sites():
    now = datetime(2026, 9, 19, 12, tzinfo=timezone.utc)
    naive = now.replace(tzinfo=None)
    source = BrokerListingsSource(None, now=lambda: now)
    sites = [
        broker_site(id="fresh"),
        broker_site(id="ok-yesterday", status="ok", last_crawled_at=naive - timedelta(days=1)),
        broker_site(id="blocked-3d", status="blocked", last_crawled_at=naive - timedelta(days=3)),
        broker_site(id="blocked-15d", status="blocked", last_crawled_at=naive - timedelta(days=15)),
        broker_site(id="error-2h", status="error", last_crawled_at=naive - timedelta(hours=2)),
        broker_site(id="error-2d", status="error", last_crawled_at=naive - timedelta(days=2)),
    ]
    assert [s.id for s in source._due_sites(sites)] == ["fresh", "ok-yesterday", "blocked-15d", "error-2d"]


def _brave_handler(results, pages=None):
    def handler(request):
        if "search.brave.com" in str(request.url) or "brave" in request.url.host:
            return httpx.Response(200, json={"web": {"results": results}})
        return site_handler(pages or {})(request)

    return handler


def test_discovery_adds_new_broker_sites_skips_known_aggregators_roundups_and_runs_once_a_week(settings, profile):
    results = [
        {"url": "https://www.newbroker.test/about", "title": "New Broker Group | Business Brokers"},
        {"url": "https://known.test/", "title": "Known"},
        {"url": "https://www.bizbuysell.com/arizona", "title": "Arizona businesses"},
        {"url": "https://roundup.test/x", "title": "10 Best Business Brokers in Arizona"},
    ]
    store = FakeStore([], known={"known.test"})
    state: dict = {}
    now = datetime(2026, 9, 19, 12, tzinfo=timezone.utc)
    source = BrokerListingsSource(FakeExtractor(), now=lambda: now)
    ctx = _ctx_with_store(settings, _brave_handler(results), store, state)

    source._discover(profile, ctx)
    assert store.added == [("New Broker Group", "newbroker.test", "https://www.newbroker.test/")]
    assert "broker_discovery_at" in state

    store.added.clear()
    source._discover(profile, ctx)
    assert store.added == []  # less than 7 days later: nothing

    later = BrokerListingsSource(FakeExtractor(), now=lambda: now + timedelta(days=8))
    again = FakeStore([], known={"known.test"})
    later._discover(profile, _ctx_with_store(settings, _brave_handler(results), again, state))
    assert [a[1] for a in again.added] == ["newbroker.test"]  # 8 days later it searches again


def test_discovery_queries_use_the_state_and_the_profile_industries(profile):
    profile = profile.__class__(**{**profile.__dict__, "category": "HVAC", "keywords": ["plumbing", "pest control"]})
    queries = BrokerListingsSource(None)._discovery_queries(profile)
    assert "business brokers AZ" in queries and "plumbing business for sale broker AZ" in queries and "HVAC business for sale broker AZ" in queries


def test_discovery_without_a_brave_key_does_nothing(settings, profile):
    settings = settings.__class__(**{**settings.__dict__, "brave_api_key": None})
    store = FakeStore([])
    BrokerListingsSource(None)._discover(profile, _ctx_with_store(settings, site_handler({}), store))
    assert store.added == []
