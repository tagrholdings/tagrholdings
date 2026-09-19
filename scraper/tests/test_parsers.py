from types import SimpleNamespace

from leadengine.enrich.company_site import CompanySiteScraper
from leadengine.sources.marketplace.bizbuysell import looks_blocked, parse_listings, search_url

SITE_HTML = """
<html><body>
  <nav>Menu Home</nav>
  <h1>Cool Air Phoenix</h1>
  <p>Family owned since 1998. Serving the Valley with 14 technicians.</p>
  <a href="mailto:info@coolair.test?subject=hi">Email us</a>
  <a href="tel:+16025550100">Call</a>
  <a href="/contact-us">Contact</a>
  <img src="logo@2x.png"> logo@2x.png
  <script>var x = 1;</script>
  <footer>ignore me</footer>
</body></html>
"""


def test_site_text_strips_chrome_and_scripts():
    text = CompanySiteScraper._visible_text(SITE_HTML)
    assert "Family owned since 1998" in text
    assert "var x" not in text and "ignore me" not in text and "Menu Home" not in text


def test_site_contacts_found_and_junk_ignored():
    emails, phones = [], []
    CompanySiteScraper._collect(SITE_HTML, emails, phones)
    assert "info@coolair.test" in emails
    assert not any(e.endswith(".png") for e in emails)
    assert "+16025550100" in phones


def test_contact_link_stays_on_same_site():
    assert CompanySiteScraper._find_contact_link(SITE_HTML, "https://coolair.test/") == "https://coolair.test/contact-us"
    offsite = '<a href="https://other.test/contact">Contact</a>'
    assert CompanySiteScraper._find_contact_link(offsite, "https://coolair.test/") is None


LISTINGS_HTML = """
<div class="results">
  <div class="listing"><a href="/Business-Opportunity/profitable-hvac-company/2010001/">Profitable HVAC Company</a>
    <span>Phoenix, AZ</span><span>Asking Price: $850,000</span><span>Cash Flow: $310,000</span></div>
  <div class="listing"><a href="/Business-Opportunity/profitable-hvac-company/2010001/">Duplicate link</a></div>
  <div class="listing"><a href="/Business-Opportunity/plumbing-route/2010002/">Plumbing Route</a>
    <span>Mesa, AZ</span><span>Asking Price: $400,000</span></div>
  <a href="/about-us">About</a>
</div>
"""


def test_marketplace_listings_parsed_and_deduped():
    candidates = parse_listings(LISTINGS_HTML, "https://www.bizbuysell.com/arizona-businesses-for-sale/")
    assert [c.dedupe_key for c in candidates] == ["bizbuysell:2010001", "bizbuysell:2010002"]
    first = candidates[0]
    assert first.business_name == "Profitable HVAC Company"
    assert first.source_url == "https://www.bizbuysell.com/Business-Opportunity/profitable-hvac-company/2010001/"
    assert "Asking Price: $850,000" in first.text


def test_marketplace_block_detection_and_url():
    assert looks_blocked("<html><title>Access Denied</title></html>")
    assert not looks_blocked(LISTINGS_HTML)
    profile = SimpleNamespace(state="AZ")
    assert search_url(profile, "HVAC repair", 1) == "https://www.bizbuysell.com/arizona-businesses-for-sale/?q=HVAC%20repair"
    assert search_url(profile, "HVAC", 2).endswith("&pg=2")
