from __future__ import annotations

import pytest

from leadengine.email_signup_form import Buyer
from leadengine.email_signup import (
    SignupOutcome,
    SignupTarget,
    attempt_signup,
    looks_like_captcha,
    run_signups,
)

FORM_HTML = '<form><input type="email" id="email"><button type="submit">Subscribe</button></form>'
RECAPTCHA_HTML = FORM_HTML + '<div class="g-recaptcha" data-sitekey="abc"></div><script src="https://www.google.com/recaptcha/api.js"></script>'
HCAPTCHA_HTML = FORM_HTML + '<div class="h-captcha" data-sitekey="abc"></div>'
TURNSTILE_HTML = FORM_HTML + '<div class="cf-turnstile"></div>'
THANKS_HTML = "<h1>Thanks! Check your inbox to confirm your subscription.</h1>"
CHALLENGE_HTML = "<h1>Please verify you're a human to continue</h1>"

TARGET = SignupTarget(
    id="src-1",
    tenant_id="tenant-1",
    site_name="BizListings",
    signup_url="https://bizlistings.test/join",
    email_field_selector="#email",
    submit_selector="button[type=submit]",
)
ADDRESS = "leads@tagrholdings.com"


class FakePage:
    """Stands in for a Playwright page: `before` is the HTML on load, `after` the HTML once the form was submitted."""

    def __init__(self, before: str, after: str | None = None, fail_on: str | None = None):
        self.before, self.after = before, after if after is not None else before
        self.fail_on = fail_on
        self.submitted = False
        self.calls: list[tuple] = []

    def goto(self, url, **kwargs):
        self.calls.append(("goto", url))

    def content(self):
        return self.after if self.submitted else self.before

    def fill(self, selector, value, **kwargs):
        if self.fail_on == "fill":
            raise TimeoutError(f"Timeout waiting for selector {selector}\nCall log: ...")
        self.calls.append(("fill", selector, value))

    def click(self, selector, **kwargs):
        if self.fail_on == "click":
            raise RuntimeError("element not clickable")
        self.calls.append(("click", selector))
        self.submitted = True

    def wait_for_timeout(self, timeout):
        self.calls.append(("wait", timeout))

    # These pages can't be read as a form (evaluate gives nothing) -> the plain email-only behaviour.
    def evaluate(self, script, arg=None):
        return None

    def select_option(self, selector, value, **kwargs):
        self.calls.append(("select", selector, value))

    def check(self, selector, **kwargs):
        self.calls.append(("check", selector))


class TestCaptchaDetection:
    def test_recognises_the_common_widgets(self):
        for html in (RECAPTCHA_HTML, HCAPTCHA_HTML, TURNSTILE_HTML, CHALLENGE_HTML):
            assert looks_like_captcha(html)

    def test_plain_forms_and_confirmations_are_not_captchas(self):
        assert not looks_like_captcha(FORM_HTML)
        assert not looks_like_captcha(THANKS_HTML)


class TestAttemptSignup:
    def test_no_captcha_fills_the_inbox_address_and_submits(self):
        page = FakePage(FORM_HTML, THANKS_HTML)
        outcome = attempt_signup(page, TARGET, ADDRESS)
        assert outcome == SignupOutcome("submitted")
        assert ("fill", "#email", ADDRESS) in page.calls
        assert ("click", "button[type=submit]") in page.calls

    def test_a_captcha_on_the_form_stops_before_touching_it(self):
        page = FakePage(RECAPTCHA_HTML)
        outcome = attempt_signup(page, TARGET, ADDRESS)
        assert outcome.result == "captcha"
        assert not any(call[0] in ("fill", "click") for call in page.calls)  # never typed into or submitted

    def test_a_challenge_that_appears_only_after_submit_counts_as_captcha(self):
        page = FakePage(FORM_HTML, CHALLENGE_HTML)
        assert attempt_signup(page, TARGET, ADDRESS).result == "captcha"

    def test_a_missing_selector_is_a_failure_with_a_readable_message(self):
        outcome = attempt_signup(FakePage(FORM_HTML, fail_on="fill"), TARGET, ADDRESS)
        assert outcome.result == "failed"
        assert "TimeoutError" in (outcome.error or "") and "#email" in (outcome.error or "")
        assert "\n" not in (outcome.error or "")  # first line only

    def test_a_click_failure_is_a_failure(self):
        assert attempt_signup(FakePage(FORM_HTML, fail_on="click"), TARGET, ADDRESS).result == "failed"


class FakeDb:
    def __init__(self, targets):
        self.targets = targets
        self.recorded: list[tuple[str, str | None]] = []
        self.subscribed_calls = 0

    def due_email_sources(self, only_ids=None):
        return [t for t in self.targets if only_ids is None or t.id in only_ids]

    def industries_for_tenant(self, tenant_id):
        return ["HVAC", "plumbing"]

    def record_signup_attempt(self, target, result, error):
        self.recorded.append((result, error))


class FakeDriver:
    def __init__(self, outcome):
        self.outcome = outcome
        self.attempts: list[str] = []

    def attempt(self, target, address, buyer=None, industries=None):
        self.attempts.append(address)
        self.context = (buyer, industries)
        return self.outcome


class AllowAll:
    def allowed(self, url):
        return True


class DenyAll:
    def allowed(self, url):
        return False


class TestRunSignups:
    def test_a_successful_submit_is_recorded_as_submitted_and_never_as_subscribed(self):
        db, driver = FakeDb([TARGET]), FakeDriver(SignupOutcome("submitted"))
        counts = run_signups(db, driver, ADDRESS, robots=AllowAll())
        assert counts == {"submitted": 1, "captcha": 0, "manual": 0, "failed": 0}
        assert db.recorded == [("submitted", None)]
        # The Database has no way to mark subscribed here at all: record_signup_attempt is the only write,
        # and (see test_db_sql) it never touches the subscribed column.
        assert driver.attempts == [ADDRESS]

    def test_a_captcha_is_recorded_so_the_site_becomes_captcha_protected(self):
        db = FakeDb([TARGET])
        counts = run_signups(db, FakeDriver(SignupOutcome("captcha")), ADDRESS, robots=AllowAll())
        assert counts["captcha"] == 1 and db.recorded == [("captcha", None)]

    def test_a_manual_outcome_is_recorded_with_its_reason_and_counted(self):
        db, driver = FakeDb([TARGET]), FakeDriver(SignupOutcome("manual", "The site requires accepting: NDA"))
        buyer = Buyer("Tanner", "480 282 2225", "TAGR Holdings")
        counts = run_signups(db, driver, ADDRESS, robots=AllowAll(), buyer=buyer)
        assert counts["manual"] == 1 and db.recorded == [("manual", "The site requires accepting: NDA")]
        assert driver.context == (buyer, ["HVAC", "plumbing"])  # who to sign up as, and the tenant's industries

    def test_robots_txt_disallow_means_no_browser_is_opened(self):
        db, driver = FakeDb([TARGET]), FakeDriver(SignupOutcome("submitted"))
        counts = run_signups(db, driver, ADDRESS, robots=DenyAll())
        assert counts["failed"] == 1 and driver.attempts == []
        assert "robots.txt" in (db.recorded[0][1] or "")

    def test_nothing_due_does_nothing(self):
        db, driver = FakeDb([]), FakeDriver(SignupOutcome("submitted"))
        assert run_signups(db, driver, ADDRESS) == {"submitted": 0, "captcha": 0, "manual": 0, "failed": 0}
        assert driver.attempts == []


class TestDatabaseNeverMarksSubscribed:
    """The confirmation email is the only thing that may set `subscribed` — pin that at the SQL level."""

    def test_record_signup_attempt_sql_leaves_subscribed_alone(self):
        import inspect

        from leadengine.db import Database

        source = inspect.getsource(Database.record_signup_attempt)
        start = source.index("update email_sources")
        sql = source[start : source.index("where id = %s", start)]  # just the SET clause
        assert "subscribed" not in sql.replace("captcha_protected", "")
        assert "set last_attempt_at = now()" in sql
        assert "captcha_protected = captcha_protected or" in sql  # a captcha is sticky

    def test_selection_sql_only_picks_unattempted_or_requested_configured_unsubscribed_sources(self):
        import inspect

        from leadengine.db import Database

        sql = inspect.getsource(Database.due_email_sources)
        for fragment in (
            "not subscribed and not captcha_protected",
            "email_field_selector is not null and submit_selector is not null",
            "attempt_requested_at is not null or last_attempt_at is null",
        ):
            assert fragment in sql


# -- forms read from the page (planner + attempt_signup with an inspected form) --------------------------------------------

from leadengine.email_signup_form import BODY_TEXT_JS, ERRORS_JS, INSPECT_JS, FormStep, plan_form, rejection_reason  # noqa: E402

BUYER = Buyer("Tanner", "480 282 2225", "TAGR Holdings")


def fld(i, **kw):
    base = dict(i=i, tag="input", type="text", name="", id="", label="", placeholder="", required=False, visible=True, value="", checked=False, isEmail=False, options=[])
    return {**base, **kw}


EMAIL = fld(0, type="email", name="email", label="Email", required=True, isEmail=True)


def plan(*fields, buyer=BUYER, industries=("HVAC", "plumbing")):
    return plan_form([EMAIL, *fields], buyer, list(industries), ADDRESS)


class TestPlanForm:
    def test_an_email_only_form_needs_nothing_else(self):
        result = plan_form([EMAIL], BUYER, [], ADDRESS)
        assert result.steps == [] and result.manual_reason is None

    def test_fills_name_phone_and_company_from_the_buyer_identity(self):
        result = plan(
            fld(1, name="first_name", label="First name *", required=True),
            fld(2, name="phone", type="tel", label="Phone", required=True),
            fld(3, name="company", label="Company", required=True),
        )
        assert result.manual_reason is None
        assert result.steps == [
            FormStep("fill", '[data-tagr-i="1"]', "Tanner"),
            FormStep("fill", '[data-tagr-i="2"]', "480 282 2225"),
            FormStep("fill", '[data-tagr-i="3"]', "TAGR Holdings"),
        ]

    def test_a_full_name_field_gets_the_whole_configured_name(self):
        assert plan(fld(1, name="name", label="Your name", required=True)).steps == [FormStep("fill", '[data-tagr-i="1"]', "Tanner")]

    def test_a_required_last_name_is_manual_when_the_configured_name_has_only_one_word(self):
        result = plan(fld(1, name="last_name", label="Last name", required=True))
        assert result.manual_reason and "last name" in result.manual_reason and result.steps == []

    def test_an_optional_last_name_is_left_empty(self):
        assert plan(fld(1, name="last_name", label="Last name")).steps == []

    def test_a_second_email_field_is_filled_with_the_same_address(self):
        assert plan(fld(1, type="email", name="email2", label="Confirm email", required=True)).steps == [FormStep("fill", '[data-tagr-i="1"]', ADDRESS)]

    @pytest.mark.parametrize(
        "field, expected",
        [
            (fld(1, type="password", name="pw", label="Password"), "password"),
            (fld(1, type="file", name="cv", label="Upload"), "file"),
            (fld(1, type="checkbox", label="I agree to the Terms of Service", required=True), "accepting"),
            (fld(1, type="checkbox", label="I will sign the NDA / confidentiality agreement", required=True), "accepting"),
            (fld(1, type="checkbox", label="I have read the privacy policy", required=True), "accepting"),
            (fld(1, name="zip", label="ZIP code *", required=True), "ZIP code"),
            (fld(1, name="budget", label="Budget", required=True), "Budget"),
            (fld(1, name="c", label="Please complete the captcha"), "captcha"),
            (fld(1, tag="select", name="size", label="Company size", required=True, options=[{"value": "1", "text": "1-10"}]), "Company size"),
        ],
    )
    def test_things_only_a_person_can_give_stop_the_signup_with_a_reason(self, field, expected):
        result = plan(field)
        assert result.manual_reason and expected in result.manual_reason
        assert result.steps == []  # nothing typed before the verdict

    def test_optional_terms_and_unknown_optional_fields_are_ignored(self):
        assert plan(fld(1, type="checkbox", label="I agree to the Terms"), fld(2, name="zip", label="ZIP")).steps == []

    def test_only_marketing_consent_checkboxes_are_ticked(self):
        result = plan(
            fld(1, type="checkbox", label="Send me new listings by email", required=True),
            fld(2, type="checkbox", label="HVAC businesses"),
            fld(3, type="checkbox", label="Franchise opportunities"),
        )
        assert result.steps == [FormStep("check", '[data-tagr-i="1"]'), FormStep("check", '[data-tagr-i="2"]')]

    def test_invisible_fields_are_never_filled_even_when_required(self):
        assert plan(fld(1, name="website", label="Leave empty", required=True, visible=False)).steps == []

    def test_industry_select_picks_the_option_matching_the_profile(self):
        select = fld(
            1, tag="select", name="industry", label="Industry", required=True,
            options=[{"value": "", "text": "Select…"}, {"value": "r", "text": "Restaurants"}, {"value": "h", "text": "Heating & Air Conditioning"}],
        )
        assert plan(select).steps == [FormStep("select", '[data-tagr-i="1"]', "h")]

    def test_industry_select_falls_back_to_an_all_industries_option_or_asks_for_a_person(self):
        options = [{"value": "", "text": "Select"}, {"value": "r", "text": "Restaurants"}]
        select = fld(1, tag="select", name="industry", label="Industry", required=True, options=options)
        assert plan(select).manual_reason
        assert plan(fld(1, tag="select", name="industry", label="Industry", required=True, options=[*options, {"value": "all", "text": "All industries"}])).steps == [
            FormStep("select", '[data-tagr-i="1"]', "all")
        ]

    def test_i_am_a_buyer_choice_and_how_did_you_hear(self):
        role = fld(1, tag="select", name="role", label="I am a", required=True, options=[{"value": "s", "text": "Seller"}, {"value": "b", "text": "Buyer"}])
        heard = fld(2, tag="select", name="src", label="How did you hear about us?", required=True, options=[{"value": "f", "text": "Friend"}, {"value": "g", "text": "Google search"}])
        assert plan(role, heard).steps == [FormStep("select", '[data-tagr-i="1"]', "b"), FormStep("select", '[data-tagr-i="2"]', "g")]

    def test_radio_groups_choose_the_industry_or_role_that_fits(self):
        radios = [
            fld(1, type="radio", name="who", label="[group] I am a Seller", required=True),
            fld(2, type="radio", name="who", label="[group] I am a Buyer", required=True),
        ]
        assert plan(*radios).steps == [FormStep("check", '[data-tagr-i="2"]')]
        unknown = [fld(1, type="radio", name="x", label="Yes", required=True), fld(2, type="radio", name="x", label="No", required=True)]
        assert plan(*unknown).manual_reason

    def test_a_required_message_gets_a_short_honest_note_an_optional_one_stays_empty(self):
        required = plan(fld(1, tag="textarea", name="message", label="Message", required=True))
        assert required.steps[0].value.startswith("Interested in buying a business (HVAC, plumbing)")
        assert plan(fld(1, tag="textarea", name="message", label="Message")).steps == []

    def test_without_any_configured_identity_a_required_name_is_manual(self):
        assert plan(fld(1, name="name", label="Name", required=True), buyer=Buyer()).manual_reason


class TestRejectionReason:
    def test_error_messages_are_a_rejection_but_thank_yous_are_not(self):
        assert "required" in (rejection_reason(["This field is required"]) or "")
        assert rejection_reason(["Thank you! Please check your email to confirm."]) is None
        assert rejection_reason(["Success: you are subscribed"]) is None
        assert rejection_reason([]) is None and rejection_reason(None) is None

    def test_a_native_block_counts_unless_the_page_shows_a_thank_you(self):
        native = ['NATIVE: the browser blocked the submit — required or invalid field "phone"']
        assert "phone" in (rejection_reason(native, "<h1>Join us</h1>") or "")
        assert rejection_reason(native, "Thank you for subscribing") is None  # the form was reset after a success


class InspectedPage(FakePage):
    """A page whose form can be read: `evaluate` answers INSPECT_JS with `form` and ERRORS_JS with `errors`."""

    def __init__(self, fields, html="<form></form>", after="<h1>Thanks</h1>", errors=None):
        super().__init__("<html>", after)
        self.form = {"fields": fields, "html": html}
        self.errors = errors or []

    def evaluate(self, script, arg=None):
        if script is INSPECT_JS:
            return self.form
        if script is BODY_TEXT_JS:
            return "Thanks for subscribing" if "Thanks" in self.after else ""
        assert script is ERRORS_JS
        return self.errors


class TestAttemptSignupWithAForm:
    def test_fills_the_buyer_details_then_the_email_then_submits(self):
        page = InspectedPage([EMAIL, fld(1, name="name", label="Name", required=True), fld(2, type="checkbox", label="Email me listings")])
        outcome = attempt_signup(page, TARGET, ADDRESS, BUYER, ["HVAC"])
        assert outcome == SignupOutcome("submitted")
        assert page.calls.count(("fill", "#email", ADDRESS)) == 1
        assert ("fill", '[data-tagr-i="1"]', "Tanner") in page.calls and ("check", '[data-tagr-i="2"]') in page.calls
        assert page.calls.index(("click", "button[type=submit]")) > page.calls.index(("check", '[data-tagr-i="2"]'))

    def test_a_form_that_needs_a_person_is_left_untouched_and_reported_as_manual(self):
        page = InspectedPage([EMAIL, fld(1, type="password", name="pw", label="Password")])
        outcome = attempt_signup(page, TARGET, ADDRESS, BUYER, [])
        assert outcome.result == "manual" and "password" in (outcome.error or "")
        assert not any(call[0] in ("fill", "click", "check", "select") for call in page.calls)

    def test_a_captcha_widget_inside_the_form_stops_it(self):
        page = InspectedPage([EMAIL], html='<form><div class="g-recaptcha" data-sitekey="k"></div></form>')
        assert attempt_signup(page, TARGET, ADDRESS, BUYER, []).result == "captcha"
        assert not any(call[0] == "fill" for call in page.calls)

    def test_a_sitewide_captcha_script_outside_the_form_does_not(self):
        page = InspectedPage([EMAIL], html="<form></form>")
        page.before = '<script src="https://www.google.com/recaptcha/api.js"></script><form></form>'  # e.g. the contact form's
        assert attempt_signup(page, TARGET, ADDRESS, BUYER, []).result == "submitted"

    def test_a_visible_validation_error_after_the_submit_makes_it_manual(self):
        page = InspectedPage([EMAIL], errors=["Please select an option"])
        outcome = attempt_signup(page, TARGET, ADDRESS, BUYER, [])
        assert outcome.result == "manual" and "Please select an option" in (outcome.error or "")

    def test_a_native_block_is_manual_but_not_when_the_thank_you_is_showing(self):
        native = ['NATIVE: the browser blocked the submit — required or invalid field "zz"']
        assert attempt_signup(InspectedPage([EMAIL], after="<h1>Join us</h1>", errors=native), TARGET, ADDRESS, BUYER, []).result == "manual"
        assert attempt_signup(InspectedPage([EMAIL], after="<h1>Thanks</h1>", errors=native), TARGET, ADDRESS, BUYER, []).result == "submitted"

    def test_a_challenge_after_the_submit_is_still_a_captcha(self):
        assert attempt_signup(InspectedPage([EMAIL], after=CHALLENGE_HTML), TARGET, ADDRESS, BUYER, []).result == "captcha"
