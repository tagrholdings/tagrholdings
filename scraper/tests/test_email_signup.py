from __future__ import annotations

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

    def record_signup_attempt(self, target, result, error):
        self.recorded.append((result, error))


class FakeDriver:
    def __init__(self, outcome):
        self.outcome = outcome
        self.attempts: list[str] = []

    def attempt(self, target, address):
        self.attempts.append(address)
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
        assert counts == {"submitted": 1, "captcha": 0, "failed": 0}
        assert db.recorded == [("submitted", None)]
        # The Database has no way to mark subscribed here at all: record_signup_attempt is the only write,
        # and (see test_db_sql) it never touches the subscribed column.
        assert driver.attempts == [ADDRESS]

    def test_a_captcha_is_recorded_so_the_site_becomes_captcha_protected(self):
        db = FakeDb([TARGET])
        counts = run_signups(db, FakeDriver(SignupOutcome("captcha")), ADDRESS, robots=AllowAll())
        assert counts["captcha"] == 1 and db.recorded == [("captcha", None)]

    def test_robots_txt_disallow_means_no_browser_is_opened(self):
        db, driver = FakeDb([TARGET]), FakeDriver(SignupOutcome("submitted"))
        counts = run_signups(db, driver, ADDRESS, robots=DenyAll())
        assert counts["failed"] == 1 and driver.attempts == []
        assert "robots.txt" in (db.recorded[0][1] or "")

    def test_nothing_due_does_nothing(self):
        db, driver = FakeDb([]), FakeDriver(SignupOutcome("submitted"))
        assert run_signups(db, driver, ADDRESS) == {"submitted": 0, "captcha": 0, "failed": 0}
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
