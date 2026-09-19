"""Company website scraping — homepage (+ one contact/about page) for contact details and size signals."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from ..util.ratelimit import DomainThrottle
from ..util.robots import RobotsCache
from ..util.urls import is_public_http_url
from .email_signup_detect import EmailSignupDetection, detect_email_only_signup

log = logging.getLogger(__name__)

MAX_BYTES = 600_000  # ignore the rest of a huge page
MAX_TEXT_CHARS = 3500  # per page, after cleaning
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")
# File-like "emails" that are really image names (logo@2x.png) and placeholder domains.
JUNK_EMAIL_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")
JUNK_EMAIL_DOMAINS = ("example.com", "sentry.io", "wixpress.com", "domain.com", "email.com")
CONTACT_HINTS = ("contact", "about")


@dataclass
class SiteInfo:
    text: str = ""
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    # Set when one of the pages read is a "listings by email signup" page (see email_signup_detect). Purely a signal
    # for `email_sources`: it changes nothing about the text/contacts above or about the lead built from them.
    email_signup: EmailSignupDetection | None = None


class CompanySiteScraper:
    def __init__(self, http: httpx.Client, robots: RobotsCache, throttle: DomainThrottle) -> None:
        self._http = http
        self._robots = robots
        self._throttle = throttle

    def scrape(self, website: str) -> SiteInfo | None:
        """Returns None if the site can't or shouldn't be read (robots, non-public host, errors)."""
        home = self._fetch(website)
        if home is None:
            return None
        html, base_url = home
        info = SiteInfo()
        texts = [self._visible_text(html)]
        emails: list[str] = []
        phones: list[str] = []
        self._collect(html, emails, phones)
        info.email_signup = detect_email_only_signup(html, base_url)

        contact_url = self._find_contact_link(html, base_url)
        if contact_url:
            contact = self._fetch(contact_url)
            if contact is not None:
                texts.append(self._visible_text(contact[0]))
                self._collect(contact[0], emails, phones)
                if info.email_signup is None:
                    info.email_signup = detect_email_only_signup(contact[0], contact[1])

        info.text = "\n\n".join(t for t in texts if t)[: MAX_TEXT_CHARS * 2]
        info.emails = list(dict.fromkeys(emails))[:5]
        info.phones = list(dict.fromkeys(phones))[:5]
        return info

    def _fetch(self, url: str) -> tuple[str, str] | None:
        if not is_public_http_url(url) or not self._robots.allowed(url):
            return None
        self._throttle.wait(urlsplit(url).netloc)
        try:
            with self._http.stream("GET", url, timeout=12, follow_redirects=True) as response:
                if response.status_code != 200 or "html" not in response.headers.get("content-type", "").lower():
                    return None
                # A redirect may have landed somewhere non-public — check the final URL too.
                if not is_public_http_url(str(response.url)):
                    return None
                chunks: list[bytes] = []
                size = 0
                for chunk in response.iter_bytes():
                    chunks.append(chunk)
                    size += len(chunk)
                    if size >= MAX_BYTES:
                        break
                return b"".join(chunks).decode(response.encoding or "utf-8", errors="replace"), str(response.url)
        except httpx.HTTPError as exc:
            log.info("Could not fetch %s: %s", url, exc)
            return None

    @staticmethod
    def _visible_text(html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "form"]):
            tag.decompose()
        text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
        return text[:MAX_TEXT_CHARS]

    @staticmethod
    def _collect(html: str, emails: list[str], phones: list[str]) -> None:
        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            if href.lower().startswith("mailto:"):
                emails.append(href[7:].split("?")[0].strip())
            elif href.lower().startswith("tel:"):
                phones.append(href[4:].strip())
        body = soup.get_text(" ", strip=True)
        emails.extend(EMAIL_RE.findall(body))
        phones.extend(PHONE_RE.findall(body)[:3])
        emails[:] = [
            e
            for e in emails
            if not e.lower().endswith(JUNK_EMAIL_SUFFIXES) and not e.lower().split("@")[-1].endswith(JUNK_EMAIL_DOMAINS)
        ]

    @staticmethod
    def _find_contact_link(html: str, base_url: str) -> str | None:
        soup = BeautifulSoup(html, "html.parser")
        base_host = urlsplit(base_url).netloc
        for hint in CONTACT_HINTS:
            for anchor in soup.find_all("a", href=True):
                label = f"{anchor['href']} {anchor.get_text(' ', strip=True)}".lower()
                if hint in label:
                    target = urljoin(base_url, anchor["href"])
                    # Same site only, and never a mailto:/tel:/fragment.
                    if urlsplit(target).netloc == base_host and urlsplit(target).scheme in ("http", "https"):
                        return target.split("#")[0]
        return None
