"""Search runs logging "listings by email signup" sites into `email_sources` (detector -> enricher/marketplace -> runner)."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import replace
from types import SimpleNamespace

import httpx

from conftest import make_ctx
from leadengine.enrich import company_site
from leadengine.enrich.company_site import CompanySiteScraper, SiteInfo
from leadengine.enrich.email_signup_detect import detect_email_only_signup
from leadengine.models import Candidate
from leadengine.util.ratelimit import DomainThrottle
from leadengine.util.robots import RobotsCache
from leadengine.util.urls import is_domain_tracked
from test_runner import CountingExtractor, FakeDb, ScriptedSource, make_runner

SIGNUP_ONLY = """<html><head><title>Coastal Business Brokers | Home</title></head><body>
<section><h2>Get listings by email</h2>
<form id="lead-signup"><input type="email" name="email" id="em"><button type="submit">Join</button></form></section>
</body></html>"""
NO_SIGNAL = "<html><head><title>Cool Air</title></head><body><h1>Cool Air Phoenix</h1><p>Family HVAC.</p></body></html>"
CONTACT_FORM_ONLY = """<html><body><h1>Contact</h1><form><input type="email" name="email">
<textarea name="msg"></textarea><button type="submit">Send</button></form></body></html>"""


# -- the enricher ---------------------------------------------------------------------------------------------


def scraper_for(pages: dict[str, str], monkeypatch) -> CompanySiteScraper:
    """A CompanySiteScraper whose HTTP is served from `pages` ({url: html}); robots.txt is absent (= allowed)."""
    monkeypatch.setattr(company_site, "is_public_http_url", lambda url: True)  # no real DNS in unit tests

    def handler(request: httpx.Request) -> httpx.Response:
        html = pages.get(str(request.url))
        if html is None:
            return httpx.Response(404)
        return httpx.Response(200, text=html, headers={"content-type": "text/html; charset=utf-8"})

    http = httpx.Client(transport=httpx.MockTransport(handler))
    return CompanySiteScraper(http, RobotsCache(http, "test-agent"), DomainThrottle(min_interval=0, jitter=0, sleep=lambda _s: None))


class TestCompanySiteScraper:
    def test_a_signup_only_homepage_is_flagged_and_the_normal_scrape_output_is_unchanged(self, monkeypatch):
        info = scraper_for({"https://coastalbrokers.test/": SIGNUP_ONLY}, monkeypatch).scrape("https://coastalbrokers.test/")
        assert info is not None and info.email_signup is not None
        assert info.email_signup.page_url == "https://coastalbrokers.test/"
        assert info.email_signup.site_name == "Coastal Business Brokers"
        assert "Get listings by email" in info.text  # the page's text is still collected as before

    def test_a_signup_form_on_the_contact_page_is_found_too(self, monkeypatch):
        home = '<html><body><h1>Cool Air</h1><a href="/contact-us">Contact</a></body></html>'
        contact = SIGNUP_ONLY.replace("Home", "Contact")
        pages = {"https://coolair.test/": home, "https://coolair.test/contact-us": contact}
        info = scraper_for(pages, monkeypatch).scrape("https://coolair.test/")
        assert info.email_signup is not None and info.email_signup.page_url == "https://coolair.test/contact-us"

    def test_an_ordinary_site_is_not_flagged(self, monkeypatch):
        assert scraper_for({"https://coolair.test/": NO_SIGNAL}, monkeypatch).scrape("https://coolair.test/").email_signup is None

    def test_a_contact_form_is_not_flagged(self, monkeypatch):
        info = scraper_for({"https://coolair.test/": CONTACT_FORM_ONLY}, monkeypatch).scrape("https://coolair.test/")
        assert info.email_signup is None

    def test_robots_disallowed_pages_are_never_read_so_never_flagged(self, monkeypatch):
        monkeypatch.setattr(company_site, "is_public_http_url", lambda url: True)

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nDisallow: /")
            return httpx.Response(200, text=SIGNUP_ONLY, headers={"content-type": "text/html"})

        http = httpx.Client(transport=httpx.MockTransport(handler))
        scraper = CompanySiteScraper(http, RobotsCache(http, "test-agent"), DomainThrottle(0, 0, sleep=lambda _s: None))
        assert scraper.scrape("https://coastalbrokers.test/") is None


# -- the runner -----------------------------------------------------------------------------------------------


class DetectionDb(FakeDb):
    """FakeDb + `record_email_source_detection` with the same rules as the real one (domain dedupe, always unsubscribed)."""

    def __init__(self, tracked_urls: list[str] | None = None, fail: bool = False):
        super().__init__()
        self.rows: list[dict] = [{"signup_url": u, "source": "manual"} for u in (tracked_urls or [])]
        self.calls = 0
        self.fail = fail

    def record_email_source_detection(self, tenant_id, detection, notes):
        self.calls += 1
        if self.fail:
            raise RuntimeError("database unavailable")
        if is_domain_tracked([r["signup_url"] for r in self.rows], detection.page_url):
            return False
        self.rows.append(
            {
                "tenant_id": tenant_id, "signup_url": detection.page_url, "site_name": detection.site_name,
                "email_field_selector": detection.email_field_selector, "submit_selector": detection.submit_selector,
                "notes": notes, "source": "auto_detected", "subscribed": False, "captcha_protected": False,
            }
        )
        return True

    @property
    def detected(self) -> list[dict]:
        return [r for r in self.rows if r["source"] == "auto_detected"]


class SignupSiteEnricher:
    """Pretends to have scraped a company website that turned out to be a signup-only page."""

    def __init__(self, html: str = SIGNUP_ONLY, url: str = "https://coastalbrokers.test/"):
        self.detection = detect_email_only_signup(html, url)
        assert self.detection is not None

    def scrape(self, website: str):
        return SiteInfo(text="Get listings by email", email_signup=self.detection)


class PlainEnricher:
    def scrape(self, website: str):
        return SiteInfo(text="Family HVAC company.")


def cand(key: str, website: str) -> Candidate:
    return Candidate("google_places", key, f"Biz {key}", website=website, text=f"text {key}")


def run(profile, db, sources, enricher):
    runner = make_runner(db, sources, CountingExtractor())
    runner._enricher = enricher
    return runner.run_profile(replace(profile, keywords=[]))


class TestRunLogsEmailSources:
    def test_a_signup_only_site_is_logged_with_the_right_fields(self, profile, caplog):
        db = DetectionDb()
        source = ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])
        with caplog.at_level(logging.INFO, logger="leadengine.runner"):
            result = run(profile, db, [source], SignupSiteEnricher())

        assert len(db.detected) == 1
        row = db.detected[0]
        assert row["tenant_id"] == profile.tenant_id  # tenant-scoped: the profile's tenant, nothing else
        assert row["signup_url"] == "https://coastalbrokers.test/"
        assert row["site_name"] == "Coastal Business Brokers"
        assert row["source"] == "auto_detected" and row["subscribed"] is False and row["captcha_protected"] is False
        assert row["email_field_selector"] and row["submit_selector"]  # so email_signup.py can attempt it next pass
        assert "Auto-detected during search profile run" in row["notes"] and profile.name in row["notes"]
        # visible in the run summary + log
        assert result.email_sources_detected == 1
        assert db.finished["email_sources_detected"] == 1
        assert "New email-only source detected: Coastal Business Brokers" in caplog.text

    def test_the_candidates_own_lead_is_built_exactly_as_before_and_detection_adds_none(self, profile):
        db = DetectionDb()
        run(profile, db, [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])], SignupSiteEnricher())
        assert list(db.leads) == [("google_places", "a")]  # only the business the search found — nothing extra from the page

    def test_a_marketplace_style_page_with_no_listings_logs_the_site_and_creates_no_lead_at_all(self, profile):
        class EmptyListingsSource:
            source_type = "marketplace_scrape"

            def search(self, profile, term, ctx):
                ctx.on_empty_page(SIGNUP_ONLY, "https://coastalbrokers.test/arizona-businesses-for-sale")
                return
                yield  # pragma: no cover - makes this a generator

        db = DetectionDb()
        marketplace_only = replace(profile, sources={**profile.sources, "google_places": False, "marketplace_scrape": True})
        result = run(marketplace_only, db, [EmptyListingsSource()], None)

        assert len(db.detected) == 1 and db.detected[0]["site_name"] == "Coastal Business Brokers"
        assert db.leads == {}  # no raw_lead from that page
        assert result.leads_added == 0 and result.email_sources_detected == 1

    def test_an_already_tracked_domain_is_not_logged_again(self, profile):
        db = DetectionDb(tracked_urls=["https://www.coastalbrokers.test/newsletter"])  # e.g. added by hand earlier
        result = run(profile, db, [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])], SignupSiteEnricher())
        assert db.detected == [] and len(db.rows) == 1
        assert result.email_sources_detected == 0 and db.finished["email_sources_detected"] == 0

    def test_a_second_run_over_the_same_site_does_not_log_it_twice(self, profile):
        db = DetectionDb()
        sources = [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])]
        first = run(profile, db, sources, SignupSiteEnricher())
        # Same candidate again + a NEW candidate on the same domain: the domain is already tracked now.
        second_sources = [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/"), cand("b", "https://coastalbrokers.test/x")]])]
        second = run(profile, db, second_sources, SignupSiteEnricher(url="https://coastalbrokers.test/x"))
        assert (first.email_sources_detected, second.email_sources_detected) == (1, 0)
        assert len(db.detected) == 1

    def test_a_domain_is_looked_up_once_per_run_however_many_pages_of_it_are_visited(self, profile):
        db = DetectionDb()
        page = [cand("a", "https://coastalbrokers.test/"), cand("b", "https://coastalbrokers.test/about"), cand("c", "https://www.coastalbrokers.test/x")]
        result = run(profile, db, [ScriptedSource("google_places", [page])], SignupSiteEnricher())
        assert db.calls == 1 and result.email_sources_detected == 1 and result.leads_added == 3

    def test_two_different_signup_sites_are_both_logged(self, profile):
        class TwoSitesEnricher:
            def scrape(self, website):
                url = f"https://{website.split('//')[1]}"
                return SiteInfo(text="x", email_signup=detect_email_only_signup(SIGNUP_ONLY, url))

        db = DetectionDb()
        page = [cand("a", "https://coastalbrokers.test/"), cand("b", "https://otherbrokers.test/")]
        result = run(profile, db, [ScriptedSource("google_places", [page])], TwoSitesEnricher())
        assert result.email_sources_detected == 2 and len(db.detected) == 2

    def test_ordinary_sites_log_nothing(self, profile):
        db = DetectionDb()
        result = run(profile, db, [ScriptedSource("google_places", [[cand("a", "https://coolair.test/")]])], PlainEnricher())
        assert db.calls == 0 and db.detected == [] and result.email_sources_detected == 0
        assert result.leads_added == 1

    def test_a_database_failure_while_logging_never_costs_the_run_a_lead(self, profile):
        db = DetectionDb(fail=True)
        result = run(profile, db, [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])], SignupSiteEnricher())
        assert result.status == "completed" and result.leads_added == 1 and result.email_sources_detected == 0

    def test_nothing_is_logged_when_company_site_scraping_is_off_for_the_profile(self, profile):
        db = DetectionDb()
        no_scrape = replace(profile, sources={**profile.sources, "company_site_scrape": False})
        result = run(no_scrape, db, [ScriptedSource("google_places", [[cand("a", "https://coastalbrokers.test/")]])], SignupSiteEnricher())
        assert db.calls == 0 and result.leads_added == 1


# -- the marketplace hook -------------------------------------------------------------------------------------


def fake_playwright(monkeypatch, html: str):
    """Swaps Playwright for a stub that serves `html` for every page."""
    import playwright.sync_api as sync_api

    page = SimpleNamespace(goto=lambda url, **kw: SimpleNamespace(status=200), content=lambda: html)
    browser = SimpleNamespace(new_context=lambda **kw: SimpleNamespace(new_page=lambda: page), close=lambda: None)
    fake = SimpleNamespace(chromium=SimpleNamespace(launch=lambda **kw: browser))

    @contextmanager
    def sync_playwright():
        yield fake

    monkeypatch.setattr(sync_api, "sync_playwright", sync_playwright)


class TestMarketplaceHook:
    def test_a_page_with_no_listings_is_handed_to_the_callback(self, settings, profile, monkeypatch):
        from leadengine.sources.marketplace.bizbuysell import BizBuySellSource

        fake_playwright(monkeypatch, SIGNUP_ONLY)
        ctx = make_ctx(settings, lambda r: httpx.Response(404))
        seen: list[tuple[str, str]] = []
        ctx.on_empty_page = lambda html, url: seen.append((html, url))

        assert list(BizBuySellSource().search(profile, "hvac", ctx)) == []
        assert len(seen) == 1 and seen[0][0] == SIGNUP_ONLY and seen[0][1].startswith("https://www.bizbuysell.com/")

    def test_a_page_that_has_listings_is_not(self, settings, profile, monkeypatch):
        from leadengine.sources.marketplace.bizbuysell import BizBuySellSource
        from test_parsers import LISTINGS_HTML

        fake_playwright(monkeypatch, LISTINGS_HTML)
        ctx = make_ctx(settings, lambda r: httpx.Response(404))
        seen: list = []
        ctx.on_empty_page = lambda html, url: seen.append(url)

        pages = list(BizBuySellSource().search(profile, "hvac", ctx))
        assert pages and seen == []

    def test_the_callback_is_optional(self, settings, profile, monkeypatch):
        from leadengine.sources.marketplace.bizbuysell import BizBuySellSource

        fake_playwright(monkeypatch, SIGNUP_ONLY)
        ctx = make_ctx(settings, lambda r: httpx.Response(404))
        assert ctx.on_empty_page is None
        assert list(BizBuySellSource().search(profile, "hvac", ctx)) == []


# -- the database contract ------------------------------------------------------------------------------------


def test_the_real_insert_only_ever_creates_unsubscribed_auto_detected_rows():
    """SQL-level pin (the real Database is exercised against Postgres in the verification script)."""
    import inspect

    from leadengine.db import Database

    source = inspect.getsource(Database.record_email_source_detection)
    assert "'auto_detected'" in source
    assert "on conflict (tenant_id, signup_url) do nothing" in source
    sql = source[source.index("insert into email_sources") : source.index("returning id")]
    for column in ("subscribed", "captcha_protected", "subscribed_at"):
        assert column not in sql  # they take their defaults: false / false / null
    assert "is_domain_tracked(existing" in source  # the domain check happens before any insert

