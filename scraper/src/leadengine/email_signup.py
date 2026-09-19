"""Automatic signup to listing sites that deliver by email — the ONE part of that flow the engine can do.

    python -m leadengine.email_signup [--source-id UUID]

Reads `email_sources` rows still waiting for a subscription (not subscribed, not captcha-protected, with
both form selectors configured, and either never attempted or explicitly re-requested from the CRM), opens
each signup page with Playwright, types the dedicated inbox address into the configured email field and
clicks the configured submit button.

What it deliberately does NOT do:
  * Solve or bypass a captcha. If the form (before submit) or the page (after submit) shows one, it stops,
    records `captchaProtected` and leaves the site as a manual signup. That is a policy, not a limitation.
  * Mark anything `subscribed`. Most of these sites use double opt-in: a submitted form is only a request.
    The subscription is confirmed when the site's confirmation email reaches the inbox and the CRM's inbound
    webhook clicks the link (modules/email-inbound).
  * Guess selectors. Every site's form is configured individually in the CRM (Leads Inbox -> Email sources).
  * Retry by itself: an attempt is recorded (`last_attempt_*`), and only an explicit "Attempt subscribe"
    click queues another — so a scheduled run never re-submits a form and spams a site.
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from dotenv import load_dotenv

from .config import ConfigError, load_settings
from .db import Database
from .util.ratelimit import DomainThrottle
from .util.robots import RobotsCache

log = logging.getLogger("leadengine.email_signup")

ACTION_TIMEOUT_MS = 15_000
PAGE_LOAD_TIMEOUT_MS = 45_000
SETTLE_MS = 2_500

# reCAPTCHA / hCaptcha / Cloudflare Turnstile / Arkose / GeeTest widgets and their script hosts.
_CAPTCHA_MARKUP = re.compile(
    r"g-recaptcha|grecaptcha|recaptcha/(?:api|enterprise)|google\.com/recaptcha|h-captcha|hcaptcha\.com|cf-turnstile|"
    r"challenges\.cloudflare\.com/turnstile|arkoselabs|funcaptcha|geetest|data-sitekey",
    re.IGNORECASE,
)
# What a page says when it puts up a challenge after a submit.
_CAPTCHA_TEXT = re.compile(r"verify (?:that )?you(?:'|’)?re (?:a )?human|are you a robot|complete the (?:captcha|security check)|unusual traffic", re.IGNORECASE)


def looks_like_captcha(html: str) -> bool:
    """True when the page carries captcha markup or a human-verification challenge."""
    return bool(_CAPTCHA_MARKUP.search(html) or _CAPTCHA_TEXT.search(html))


@dataclass
class SignupTarget:
    id: str
    tenant_id: str
    site_name: str
    signup_url: str
    email_field_selector: str
    submit_selector: str


@dataclass
class SignupOutcome:
    # submitted: the form went out (NOT a subscription yet) | captcha: stopped, manual signup | failed: something broke
    result: str
    error: str | None = None


class PageLike(Protocol):
    """The slice of a Playwright page this module uses — small so the logic can be tested with a fake."""

    def goto(self, url: str, **kwargs: Any) -> Any: ...
    def content(self) -> str: ...
    def fill(self, selector: str, value: str, **kwargs: Any) -> Any: ...
    def click(self, selector: str, **kwargs: Any) -> Any: ...
    def wait_for_timeout(self, timeout: float) -> Any: ...


def attempt_signup(page: PageLike, target: SignupTarget, address: str) -> SignupOutcome:
    """Fill and submit one signup form. Never solves a captcha; never claims a subscription."""
    try:
        page.goto(target.signup_url, timeout=PAGE_LOAD_TIMEOUT_MS, wait_until="domcontentloaded")
        if looks_like_captcha(page.content()):
            return SignupOutcome("captcha")  # do not touch a form that has one

        page.fill(target.email_field_selector, address, timeout=ACTION_TIMEOUT_MS)
        page.click(target.submit_selector, timeout=ACTION_TIMEOUT_MS)
        page.wait_for_timeout(SETTLE_MS)

        # A challenge that only appears on submit means the submit didn't get through — same outcome.
        if looks_like_captcha(page.content()):
            return SignupOutcome("captcha")
        return SignupOutcome("submitted")
    except Exception as exc:  # noqa: BLE001 - selector not found, timeout, navigation error…
        return SignupOutcome("failed", f"{type(exc).__name__}: {str(exc).splitlines()[0][:200]}")


class SignupDriver(Protocol):
    def attempt(self, target: SignupTarget, address: str) -> SignupOutcome: ...


class PlaywrightSignupDriver:
    """One fresh browser context per site — no cookies or state carried between them."""

    def __init__(self, user_agent: str) -> None:
        self._user_agent = user_agent

    def attempt(self, target: SignupTarget, address: str) -> SignupOutcome:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return SignupOutcome("failed", "Playwright is not installed.")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                page = browser.new_context(user_agent=self._user_agent, locale="en-US").new_page()
                return attempt_signup(page, target, address)
            finally:
                browser.close()


def run_signups(
    db: Any,
    driver: SignupDriver,
    address: str,
    robots: RobotsCache | None = None,
    throttle: DomainThrottle | None = None,
    only_ids: list[str] | None = None,
) -> dict[str, int]:
    """Attempts every due source and records each outcome. Returns counts per result."""
    counts = {"submitted": 0, "captcha": 0, "failed": 0}
    for target in db.due_email_sources(only_ids):
        if robots is not None and not robots.allowed(target.signup_url):
            outcome = SignupOutcome("failed", "robots.txt disallows opening this signup page.")
        else:
            if throttle is not None:
                throttle.wait(re.sub(r"^https?://([^/]+).*$", r"\1", target.signup_url))
            log.info("Signing up to %s (%s)…", target.site_name, target.signup_url)
            outcome = driver.attempt(target, address)

        # Recorded either way. `submitted` leaves the site unsubscribed: the confirmation email does that.
        db.record_signup_attempt(target, outcome.result, outcome.error)
        counts[outcome.result] += 1
        log.info("  %s: %s%s", target.site_name, outcome.result, f" — {outcome.error}" if outcome.error else "")
    return counts


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    load_dotenv()

    parser = argparse.ArgumentParser(prog="leadengine.email_signup", description="Auto-subscribe the leads inbox to listing sites")
    parser.add_argument("--source-id", action="append", default=None, help="Only this email source (repeatable).")
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
    except ConfigError as exc:
        log.error("%s", exc)
        return 2

    db = Database(settings.database_url)
    try:
        if not db.try_lock():
            log.warning("Another engine run holds the lock — exiting.")
            return 0
        # Nothing to do is the normal case on most scheduled ticks — that must not need (or fail on) any setup.
        if not db.due_email_sources(args.source_id):
            log.info("No email-source signups are due.")
            return 0
        if not settings.inbound_leads_address:
            log.error("INBOUND_LEADS_ADDRESS is not set — that is the address the signups use (e.g. leads@tagrholdings.com).")
            return 2
        with httpx.Client(headers={"User-Agent": settings.user_agent}) as http:
            counts = run_signups(
                db,
                PlaywrightSignupDriver(settings.user_agent),
                settings.inbound_leads_address,
                robots=RobotsCache(http, settings.user_agent),
                throttle=DomainThrottle(min_interval=5.0, jitter=3.0),
                only_ids=args.source_id,
            )
        log.info("Done: %(submitted)d submitted (awaiting confirmation email), %(captcha)d captcha, %(failed)d failed.", counts)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
