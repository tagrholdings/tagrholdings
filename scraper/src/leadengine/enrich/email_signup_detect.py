"""Spots pages that offer listings ONLY by email signup, so the site can be logged into `email_sources`.

A page is flagged only when BOTH of these hold for the same <form>:

  1. the form has an actual email field — <input type="email">, or a text input clearly labelled as an email
     (name / id / placeholder / aria-label / its <label>);
  2. the text in that form — or in the small section it sits in — contains one of a few specific phrases
     ("subscribe", "get listings by email", "email alerts", "sign up to receive").

Neither signal alone is enough (see `email_sources` docs): a keyword without a form is just prose, and an email
box without the phrases is as likely a login or contact form. The bias is deliberately toward precision — a missed
detection costs nothing (a person notices the site later, exactly as before), while a false positive would put an
irrelevant site on the list and later trigger an automatic signup. Forms with a password or a free-text message
box (login, contact, registration) are ignored outright.

Pure functions over HTML: no network, no database — the caller decides what to do with a detection.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from bs4 import BeautifulSoup, Tag

# The whole keyword set. Word-bounded so "unsubscribe" / "subscription" never count as "subscribe".
KEYWORD_PATTERNS = (
    re.compile(r"\bsubscribe\b", re.IGNORECASE),
    re.compile(r"\bget\s+(?:new\s+)?listings\s+by\s+e-?mail\b", re.IGNORECASE),
    re.compile(r"\be-?mail\s+alerts?\b", re.IGNORECASE),
    re.compile(r"\bsign\s+up\s+to\s+receive\b", re.IGNORECASE),
)

# "Same form/section": the form's own text, plus at most this many enclosing elements — but only while the
# enclosing element stays small. A footer or <body> holding half the page is not "nearby".
MAX_ANCESTOR_LEVELS = 3
MAX_SECTION_TEXT_CHARS = 600

_EMAIL_HINT = re.compile(r"e-?mail", re.IGNORECASE)
_TEXT_LIKE_INPUT_TYPES = {"", "text", "email"}
_SAFE_IDENT = re.compile(r"^[A-Za-z_][\w-]*$")
_TITLE_SEPARATORS = re.compile(r"\s+[|\-–—·»:]\s+")


@dataclass(frozen=True)
class EmailSignupDetection:
    page_url: str
    site_name: str
    # CSS selectors resolved against the static HTML, unique in the document. None when the submit control
    # couldn't be pinned down (e.g. a JavaScript-only button): the site is still logged, as a manual signup.
    email_field_selector: str | None
    submit_selector: str | None


# -- the two signals --------------------------------------------------------------------------------------


def _attr(el: Tag, name: str) -> str:
    value = el.get(name)
    if isinstance(value, list):
        value = " ".join(value)
    return (value or "").strip()


def _label_text(soup: BeautifulSoup, field: Tag) -> str:
    parts = []
    field_id = _attr(field, "id")
    if field_id:
        parts += [lbl.get_text(" ", strip=True) for lbl in soup.find_all("label", attrs={"for": field_id})]
    wrapping = field.find_parent("label")
    if wrapping is not None:
        parts.append(wrapping.get_text(" ", strip=True))
    return " ".join(parts)


def _email_field(soup: BeautifulSoup, form: Tag) -> Tag | None:
    """The form's email input, or None. Password / free-text message forms never qualify."""
    if form.find("textarea") or form.find("input", attrs={"type": re.compile(r"^password$", re.IGNORECASE)}):
        return None
    for field in form.find_all("input"):
        field_type = _attr(field, "type").lower()
        if field_type == "email":
            return field
        if field_type in _TEXT_LIKE_INPUT_TYPES:
            hints = " ".join([_attr(field, "name"), _attr(field, "id"), _attr(field, "placeholder"), _attr(field, "aria-label"), _label_text(soup, field)])
            if _EMAIL_HINT.search(hints):
                return field
    return None


def _own_text(form: Tag) -> str:
    """Visible text of the form plus the attributes that carry wording (a submit button's value, placeholders…)."""
    parts = [form.get_text(" ", strip=True)]
    for el in form.find_all(True):
        for attr in ("value", "placeholder", "aria-label", "title", "alt"):
            if el.name == "input" and attr == "value" and _attr(el, "type").lower() not in ("submit", "button", "image"):
                continue  # a typed-in value isn't wording
            text = _attr(el, attr)
            if text:
                parts.append(text)
    return " ".join(parts)


def _section_text(form: Tag) -> str:
    """Form text widened to the small enclosing section, so a heading like "Get listings by email" just above the
    form counts — but a keyword elsewhere on the page does not."""
    text = _own_text(form)
    node: Tag = form
    for _ in range(MAX_ANCESTOR_LEVELS):
        parent = node.parent
        if parent is None or parent.name in ("body", "html", "[document]"):
            break
        parent_text = parent.get_text(" ", strip=True)
        if len(parent_text) > MAX_SECTION_TEXT_CHARS:
            break
        text = f"{parent_text} {text}"
        node = parent
    return text


def _has_keyword(text: str) -> bool:
    return any(pattern.search(text) for pattern in KEYWORD_PATTERNS)


# -- selectors --------------------------------------------------------------------------------------------


def _css_path(el: Tag, soup: BeautifulSoup) -> str:
    """A selector unique in the document: anchored on the nearest unique id, else a tag/nth-of-type path."""
    parts: list[str] = []
    node: Tag | None = el
    while node is not None and node.name and node.name != "[document]":
        ident = _attr(node, "id")
        if ident and _SAFE_IDENT.match(ident) and len(soup.find_all(id=ident)) == 1:
            parts.append(f"#{ident}")
            break
        siblings = node.parent.find_all(node.name, recursive=False) if node.parent is not None else [node]
        parts.append(f"{node.name}:nth-of-type({siblings.index(node) + 1})" if len(siblings) > 1 else node.name)
        node = node.parent
    return " > ".join(reversed(parts))


def _unique(soup: BeautifulSoup, selector: str, el: Tag) -> bool:
    try:
        found = soup.select(selector)
    except Exception:  # noqa: BLE001 - an unparsable selector is simply not usable
        return False
    return len(found) == 1 and found[0] is el


def _email_selector(soup: BeautifulSoup, form: Tag, field: Tag) -> str | None:
    ident = _attr(field, "id")
    candidates = []
    if ident and _SAFE_IDENT.match(ident):
        candidates.append(f"#{ident}")
    name = _attr(field, "name")
    if name and re.match(r"^[\w\-\[\].:]+$", name):
        candidates.append(f'{_css_path(form, soup)} input[name="{name}"]')
    candidates.append(_css_path(field, soup))
    return next((c for c in candidates if _unique(soup, c, field)), None)


def _submit_control(form: Tag) -> Tag | None:
    return (
        form.find("button", attrs={"type": re.compile(r"^submit$", re.IGNORECASE)})
        or form.find("input", attrs={"type": re.compile(r"^(?:submit|image)$", re.IGNORECASE)})
        or form.find("button", attrs={"type": None})  # a <button> with no type submits its form
    )


# -- naming -----------------------------------------------------------------------------------------------


def _site_name(soup: BeautifulSoup, page_url: str) -> str:
    host = (urlsplit(page_url).hostname or "").lower().removeprefix("www.")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    first = _TITLE_SEPARATORS.split(title)[0].strip() if title else ""
    name = first if 2 <= len(first) <= 80 else host
    return (name or host or "Unnamed site")[:200]


# -- entry point ------------------------------------------------------------------------------------------


def detect_email_only_signup(html: str, page_url: str) -> EmailSignupDetection | None:
    """The first form on the page that has BOTH an email field and one of the keyword phrases nearby; else None."""
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    for form in soup.find_all("form"):
        field = _email_field(soup, form)
        if field is None or not _has_keyword(_section_text(form)):
            continue
        submit = _submit_control(form)
        submit_selector = _css_path(submit, soup) if submit is not None else None
        if submit_selector is not None and not _unique(soup, submit_selector, submit):
            submit_selector = None
        return EmailSignupDetection(
            page_url=page_url.split("#")[0],
            site_name=_site_name(soup, page_url),
            email_field_selector=_email_selector(soup, form, field),
            submit_selector=submit_selector,
        )
    return None
