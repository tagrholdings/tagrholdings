"""Reading a broker's website: page text for the AI, and finding the links worth following. Pure functions over HTML."""

from __future__ import annotations

import hashlib
import re
from urllib.parse import urlencode, urljoin, urlsplit

from bs4 import BeautifulSoup

from .urls import registrable_domain

# Industries a search profile can name -> the words a listing site uses for them. A profile term that isn't here is
# matched as the phrase itself. Deliberately generous: a missed listing is worse than an extra one the person dismisses.
INDUSTRY_SYNONYMS: dict[str, str] = {
    "hvac": r"hvac|heating|air[- ]?condition|\ba/c\b|cooling|refrigeration",
    "plumbing": r"plumb|drain|sewer|septic",
    "pest control": r"pest|extermin|termite|rodent",
    "property management": r"property[- ]manage|rental[- ]manage|apartment[- ]manage",
}


def industry_pattern(terms: list[str]) -> re.Pattern[str] | None:
    """One regex matching ANY of the profile's industries (None when the profile names none = keep everything)."""
    parts: list[str] = []
    for raw in terms:
        term = raw.strip().lower()
        if not term:
            continue
        known = next((syn for key, syn in INDUSTRY_SYNONYMS.items() if key in term or term in key), None)
        parts.append(known or re.escape(term))
    return re.compile("|".join(parts), re.IGNORECASE) if parts else None


def page_text_with_links(html: str, base_url: str, max_chars: int) -> str:
    """Visible text of a page, each link kept inline as `label (absolute url)` — a listing's link is the most valuable part."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "template"]):
        tag.decompose()
    for anchor in soup.find_all("a", href=True):
        href = urljoin(base_url, anchor["href"].strip())
        if href.startswith(("http://", "https://")):
            label = anchor.get_text(" ", strip=True) or "link"
            anchor.replace_with(f" {label} ({href}) ")
    return re.sub(r"\n{3,}", "\n\n", soup.get_text("\n", strip=True))[:max_chars]


def content_hash(text: str) -> str:
    return hashlib.sha1(re.sub(r"\s+", " ", text).strip().lower().encode("utf-8")).hexdigest()[:20]


def _same_site_links(html: str, base_url: str) -> list[tuple[str, str, bool]]:
    """(absolute url, "label path" text, rel=next) for every link on the same registrable domain."""
    site = registrable_domain(base_url)
    found: list[tuple[str, str, bool]] = []
    for anchor in BeautifulSoup(html, "html.parser").find_all("a", href=True):
        url = urljoin(base_url, anchor["href"].strip()).split("#")[0]
        if not url.startswith(("http://", "https://")) or registrable_domain(url) != site:
            continue
        label = anchor.get_text(" ", strip=True)
        rel = anchor.get("rel") or []
        found.append((url, f"{label} {urlsplit(url).path}", "next" in rel))
    return found


LISTING_LINK = re.compile(
    r"listing|buy[- ]a[- ]business|businesses[- ]for[- ]sale|business(es)?[- ]available|available[- ]business|"
    r"opportunit|search[- ]businesses|current[- ]business|browse[- ]business|view[- ]all",
    re.IGNORECASE,
)
NOT_LISTING = re.compile(
    r"sell|valuation|contact|about|blog|team|faq|privacy|terms|login|sign[- ]?in|franchise|financ|news|press|career|"
    r"testimonial|resource|podcast|disclaimer|cookie|sitemap|\.pdf|\bsold\b|closed[- ]deal",
    re.IGNORECASE,
)
NEXT_LABEL = re.compile(r"^\s*(next|older|more|›|»|>|next page|load more)\b", re.IGNORECASE)


def find_listing_pages(html: str, base_url: str, limit: int = 3) -> list[str]:
    """Pages of the same site that look like they list businesses for sale, best first."""
    scored: dict[str, int] = {}
    for url, label, _ in _same_site_links(html, base_url):
        if LISTING_LINK.search(label) and not NOT_LISTING.search(label):
            scored[url] = scored.get(url, 0) + 1
    return [u for u, _ in sorted(scored.items(), key=lambda kv: (-kv[1], len(kv[0])))][:limit]


def find_industry_pages(html: str, base_url: str, pattern: re.Pattern[str] | None, limit: int = 3) -> list[str]:
    """Links whose text or path names one of the wanted industries — the category pages a person would click."""
    if pattern is None:
        return []
    seen: dict[str, None] = {}
    for url, label, _ in _same_site_links(html, base_url):
        if pattern.search(label) and not NOT_LISTING.search(label):
            seen.setdefault(url)
    return list(seen)[:limit]


_PAGE_PARAM = re.compile(r"[?&](?:page|pg|paged|pagenum|pageno|p)=(\d+)", re.IGNORECASE)
_PAGE_PATH = re.compile(r"/page/(\d+)(?:/|$)", re.IGNORECASE)


def _page_number(url: str) -> int | None:
    match = _PAGE_PARAM.search(url) or _PAGE_PATH.search(url)
    return int(match.group(1)) if match else None


def find_next_page(html: str, base_url: str, current_url: str | None = None) -> str | None:
    """The next page of a paginated listing: a "Next"-style link, else the numbered link right after this page's number."""
    links = _same_site_links(html, base_url)
    for url, label, is_next in links:
        if is_next or NEXT_LABEL.match(label.split(" /")[0]):
            return url
    current = _page_number(current_url or base_url) or 1
    numbered = sorted({(n, url) for url, _, _ in links if (n := _page_number(url)) is not None and n > current})
    return numbered[0][1] if numbered and numbered[0][0] == current + 1 else None


_SEARCH_FIELD = re.compile(r"^(s|q|query|search|keyword|keywords|term|searchterm|search_term|kw|text)$", re.IGNORECASE)


def find_search_urls(html: str, base_url: str, terms: list[str], limit: int = 4) -> list[str]:
    """The site's own keyword search, used the way a person would: one results URL per industry term.

    Only a plain GET search form on the same site qualifies (a read-only request — the URL a browser would build). A POST
    form, a login/newsletter form (password or email field) or anything that isn't a keyword box is left alone.
    """
    site = registrable_domain(base_url)
    for form in BeautifulSoup(html, "html.parser").find_all("form"):
        if (form.get("method") or "get").lower() != "get":
            continue
        inputs = form.find_all("input")
        if any((i.get("type") or "").lower() in ("password", "email") for i in inputs):
            continue
        box = next(
            (
                i
                for i in inputs
                if (i.get("type") or "text").lower() in ("text", "search")
                and i.get("name")
                and (_SEARCH_FIELD.match(i["name"]) or "search" in f"{i.get('placeholder', '')} {i.get('aria-label', '')}".lower())
            ),
            None,
        )
        if box is None:
            continue
        action = urljoin(base_url, form.get("action") or base_url)
        if registrable_domain(action) != site:
            continue
        fixed = {i["name"]: i.get("value", "") for i in inputs if i.get("name") and (i.get("type") or "").lower() == "hidden"}
        for select in form.find_all("select"):
            chosen = select.find("option", selected=True)
            if select.get("name") and chosen is not None and chosen.get("value"):
                fixed[select["name"]] = chosen["value"]
        sep = "&" if "?" in action else "?"
        return [f"{action}{sep}{urlencode({**fixed, box['name']: term})}" for term in terms[:limit] if term.strip()]
    return []
