from __future__ import annotations

from bs4 import BeautifulSoup

from leadengine.enrich.email_signup_detect import detect_email_only_signup
from leadengine.util.urls import is_domain_tracked, registrable_domain

URL = "https://coastalbrokers.test/listings"


def page(body: str, title: str = "Coastal Business Brokers | Businesses for sale") -> str:
    return f"<html><head><title>{title}</title></head><body>{body}</body></html>"


SIGNUP_ONLY = page(
    """
    <section>
      <h2>Get listings by email</h2>
      <form id="lead-signup" action="/join" method="post">
        <input type="email" name="email" id="em" placeholder="you@example.com">
        <button type="submit">Join</button>
      </form>
    </section>
    """
)


def resolves_to(html: str, selector: str | None, tag: str) -> bool:
    """The selector is unique in the document and points at the expected element."""
    assert selector, "expected a selector"
    found = BeautifulSoup(html, "html.parser").select(selector)
    return len(found) == 1 and found[0].name == tag


class TestBothSignalsRequired:
    def test_email_input_plus_keyword_in_the_same_section_is_detected(self):
        detection = detect_email_only_signup(SIGNUP_ONLY, URL)
        assert detection is not None
        assert detection.page_url == URL
        assert detection.site_name == "Coastal Business Brokers"
        assert resolves_to(SIGNUP_ONLY, detection.email_field_selector, "input")
        assert resolves_to(SIGNUP_ONLY, detection.submit_selector, "button")

    def test_keyword_text_alone_is_not_enough(self):
        html = page("<h2>Subscribe to our blog</h2><p>Get listings by email — coming soon. Email alerts soon.</p>")
        assert detect_email_only_signup(html, URL) is None

    def test_keyword_in_a_form_without_an_email_field_is_not_enough(self):
        html = page('<form><label>Your name <input type="text" name="fullname"></label><button>Subscribe</button></form>')
        assert detect_email_only_signup(html, URL) is None

    def test_email_input_alone_is_not_enough(self):
        html = page('<form><input type="email" name="email"><button type="submit">Go</button></form>')
        assert detect_email_only_signup(html, URL) is None

    def test_a_contact_form_is_not_a_signup_even_with_an_email_box(self):
        html = page(
            """<form><h3>Contact us</h3><input type="email" name="email"><textarea name="message"></textarea>
               <button type="submit">Send message</button></form>"""
        )
        assert detect_email_only_signup(html, URL) is None

    def test_a_login_form_is_not_a_signup_even_if_the_page_says_subscribe(self):
        html = page(
            """<form><h3>Member login — subscribe for full access</h3><input type="email" name="email">
               <input type="password" name="pw"><button type="submit">Log in</button></form>"""
        )
        assert detect_email_only_signup(html, URL) is None


class TestKeywords:
    def test_each_keyword_phrase_counts_case_insensitively(self):
        for phrase in ("SUBSCRIBE", "Get new listings by e-mail", "Email Alerts", "Sign up to receive our weekly list"):
            html = page(f'<div><p>{phrase}</p><form><input type="email" name="email"><button type="submit">Go</button></form></div>')
            assert detect_email_only_signup(html, URL) is not None, phrase

    def test_unsubscribe_and_subscription_are_not_the_keyword_subscribe(self):
        for phrase in ("To unsubscribe, enter your email", "Manage your subscription"):
            html = page(f'<div><p>{phrase}</p><form><input type="email" name="email"><button type="submit">Go</button></form></div>')
            assert detect_email_only_signup(html, URL) is None, phrase

    def test_the_submit_buttons_own_wording_counts(self):
        html = page('<form><input type="email" name="email"><input type="submit" value="Subscribe"></form>')
        assert detect_email_only_signup(html, URL) is not None

    def test_a_keyword_elsewhere_on_the_page_is_not_nearby(self):
        filler = "Unrelated paragraph about the company history. " * 30  # far more than one small section
        html = page(
            f"""<div id="blog"><h2>Subscribe to our blog</h2><p>{filler}</p></div>
                <div id="contact"><form><input type="email" name="email"><button type="submit">Go</button></form></div>"""
        )
        assert detect_email_only_signup(html, URL) is None

    def test_a_heading_in_the_same_small_section_is_nearby(self):
        html = page(
            '<div id="promo"><h3>Email alerts</h3><form><input type="email" name="email"><button type="submit">Go</button></form></div>'
        )
        assert detect_email_only_signup(html, URL) is not None


class TestEmailField:
    def test_a_text_input_clearly_labelled_as_email_counts(self):
        for field in (
            '<input type="text" placeholder="Your e-mail">',
            '<input name="user_email">',
            '<input aria-label="Email address">',
            '<label for="x">Email</label><input id="x" type="text">',
        ):
            html = page(f'<form>{field}<button type="submit">Subscribe</button></form>')
            assert detect_email_only_signup(html, URL) is not None, field

    def test_other_inputs_do_not_count_as_email(self):
        html = page('<form><input type="text" name="q" placeholder="Search"><button type="submit">Subscribe</button></form>')
        assert detect_email_only_signup(html, URL) is None


class TestSelectorsAndNaming:
    def test_selectors_are_unique_even_without_any_ids(self):
        html = page(
            """<div><form><input type="email" name="a"><button type="submit">Subscribe</button></form></div>
               <div><form><input type="email" name="a"><button type="submit">Search</button></form></div>"""
        )
        detection = detect_email_only_signup(html, URL)
        assert detection is not None
        assert resolves_to(html, detection.email_field_selector, "input")
        assert resolves_to(html, detection.submit_selector, "button")
        # ...and they point into the FIRST form (the one with the keyword), not the second.
        first_form = BeautifulSoup(html, "html.parser").find("form")
        assert BeautifulSoup(html, "html.parser").select(detection.submit_selector)[0].get_text() == "Subscribe"
        assert first_form is not None

    def test_a_form_without_a_real_submit_control_is_still_logged_but_not_automatable(self):
        html = page('<form><input type="email" name="email"><button type="button" onclick="go()">Subscribe</button></form>')
        detection = detect_email_only_signup(html, URL)
        assert detection is not None and detection.submit_selector is None

    def test_site_name_comes_from_the_title_else_the_domain(self):
        assert detect_email_only_signup(SIGNUP_ONLY, URL).site_name == "Coastal Business Brokers"
        untitled = "<html><body>" + SIGNUP_ONLY.split("<body>")[1]
        assert detect_email_only_signup(untitled, "https://www.coastalbrokers.test/x").site_name == "coastalbrokers.test"

    def test_fragment_is_dropped_from_the_signup_url(self):
        assert detect_email_only_signup(SIGNUP_ONLY, URL + "#footer").page_url == URL

    def test_no_html_no_detection(self):
        assert detect_email_only_signup("", URL) is None
        assert detect_email_only_signup("<html><body>no forms here</body></html>", URL) is None


class TestDomainTracking:
    def test_registrable_domain(self):
        assert registrable_domain("https://www.BizListings.test/newsletter") == "bizlistings.test"
        assert registrable_domain("https://listings.bizlistings.test/x") == "bizlistings.test"
        assert registrable_domain("https://a.b.example.co.uk/") == "example.co.uk"
        assert registrable_domain("") == ""

    def test_a_domain_already_on_the_list_is_tracked_whatever_the_page_or_subdomain(self):
        existing = ["https://www.bizlistings.test/newsletter", "https://other.test/join"]
        assert is_domain_tracked(existing, "https://bizlistings.test/join")
        assert is_domain_tracked(existing, "https://listings.bizlistings.test/alerts")
        assert not is_domain_tracked(existing, "https://coastalbrokers.test/listings")
        assert not is_domain_tracked([], "https://coastalbrokers.test/listings")
