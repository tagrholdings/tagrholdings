"""Deciding what a signup form needs — pure functions over field descriptors, no browser.

`email_signup` reads the form out of the page (see INSPECT_JS) and asks `plan_form` what to do with it:

  * fill what the buyer identity (BUYER_NAME / BUYER_PHONE / BUYER_COMPANY) covers: name, phone, company, the
    inbox address (also a "confirm email" field), an industry choice matching the profiles' industries,
    a "I am a buyer" choice;
  * tick ONLY marketing-consent checkboxes ("send me listings / alerts / the newsletter") and industry checkboxes;
  * leave optional fields empty and never touch invisible ones (honeypots);
  * hand the site to a person — `manual_reason` — the moment it wants something we must not or cannot supply:
    a password/account, a file, an NDA / terms / privacy-policy acceptance, a captcha, or any REQUIRED field we
    have no answer for (never invented). Nothing is typed before that verdict, so a site is never half-filled.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .util.pages import industry_pattern

# Runs in the page. Marks every field of the form that holds the email input with data-tagr-i so the planner's
# selectors can address it, and returns descriptors + the form's HTML (for the form-scoped captcha check).
INSPECT_JS = """
(emailSelector) => {
  const email = document.querySelector(emailSelector);
  if (!email) return null;
  let root = email.closest('form');
  if (!root) {
    root = email;
    for (let i = 0; i < 4 && root.parentElement && root.parentElement !== document.body; i++) root = root.parentElement;
  }
  const shown = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const labelOf = (el) => {
    const parts = [];
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) parts.push(l.innerText); }
    const wrap = el.closest('label'); if (wrap) parts.push(wrap.innerText);
    const aria = el.getAttribute('aria-label'); if (aria) parts.push(aria);
    const by = el.getAttribute('aria-labelledby');
    if (by) by.split(/\\s+/).forEach((id) => { const n = document.getElementById(id); if (n) parts.push(n.innerText); });
    const legend = el.closest('fieldset') && el.closest('fieldset').querySelector('legend');
    if (legend && (el.type === 'radio' || el.type === 'checkbox')) parts.push('[group] ' + legend.innerText);
    return parts.join(' ').replace(/\\s+/g, ' ').trim().slice(0, 240);
  };
  const fields = [];
  root.querySelectorAll('input, select, textarea').forEach((el, i) => {
    el.setAttribute('data-tagr-i', String(i));
    const choice = el.type === 'checkbox' || el.type === 'radio';
    const labels = el.labels ? Array.from(el.labels) : [];
    fields.push({
      i, tag: el.tagName.toLowerCase(), type: (el.getAttribute('type') || '').toLowerCase(),
      name: el.name || '', id: el.id || '', label: labelOf(el), placeholder: el.getAttribute('placeholder') || '',
      required: !!el.required || el.getAttribute('aria-required') === 'true',
      visible: shown(el) || (choice && labels.some(shown)),
      value: el.value || '', checked: !!el.checked, isEmail: el === email,
      options: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => ({ value: o.value, text: o.text.trim() })) : [],
    });
  });
  return { fields, html: root.outerHTML.slice(0, 80000) };
}
"""

# Runs after the submit: the visible validation / error messages on the page, plus — for the form we filled — the
# browser's own "required / invalid" verdict (a native block leaves no message in the DOM). Those come back prefixed
# with NATIVE so `rejection_reason` can ignore them when the page has meanwhile shown a thank-you and reset the form.
ERRORS_JS = """
() => {
  const shown = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const out = [];
  document.querySelectorAll('[role="alert"], [class*="error" i], [class*="invalid" i], [aria-live="assertive"]').forEach((el) => {
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t.length >= 3 && t.length <= 200 && shown(el) && !out.includes(t)) out.push(t);
  });
  document.querySelectorAll('form').forEach((f) => {
    if (!f.querySelector('[data-tagr-i]') || f.checkValidity()) return;
    const bad = Array.from(f.elements).find((e) => e.willValidate && !e.checkValidity());
    if (bad) out.push('NATIVE: The browser blocked the submit — required or invalid field "' + (bad.name || bad.id || bad.type) + '"');
  });
  return out.slice(0, 6);
}
"""

# What the visitor can actually read (raw HTML has "/thanks" in a form action, "success" in a class, ...).
BODY_TEXT_JS = "() => (document.body ? document.body.innerText : '').slice(0, 6000)"

_THANKS = re.compile(r"thank|success|subscribed|confirm|check your (?:inbox|e-?mail)|you(?:'|’)?re (?:all )?set|welcome", re.IGNORECASE)
_ERROR_TEXT = re.compile(
    r"required|invalid|not valid|incorrect|please (?:enter|fill|select|choose|provide|complete|check|accept|agree)|must |"
    r"error|failed|unable|try again|too short|can(?:no|')t be blank",
    re.IGNORECASE,
)


def rejection_reason(errors: list[str] | None, page_text: str = "") -> str | None:
    """The first visible message that reads like the site refusing the form (a 'Thank you!' alert is not one).

    `NATIVE:` messages (the browser's own validity check) are dropped when the page shows a thank-you: AJAX forms
    reset their fields after a success, which would otherwise look like empty required fields."""
    thanked = bool(_THANKS.search(page_text))
    for text in errors or []:
        if text.startswith("NATIVE:"):
            if not thanked:
                return text.removeprefix("NATIVE:").strip()[:200]
        elif _ERROR_TEXT.search(text) and not _THANKS.search(text):
            return f"The site rejected the form: “{text[:150]}”"
    return None


@dataclass(frozen=True)
class Buyer:
    """Who the engine signs up as. Only what the owner configured — never invented."""

    name: str | None = None
    phone: str | None = None
    company: str | None = None

    @property
    def first_name(self) -> str | None:
        return self.name.split()[0] if self.name and self.name.strip() else None

    @property
    def last_name(self) -> str | None:
        parts = (self.name or "").split()
        return " ".join(parts[1:]) or None


@dataclass(frozen=True)
class FormStep:
    kind: str  # fill | select | check
    selector: str
    value: str = ""


@dataclass
class FormPlan:
    steps: list[FormStep] = field(default_factory=list)
    manual_reason: str | None = None


# -- classification ----------------------------------------------------------------------------------------------------

_SKIP_TYPES = {"hidden", "submit", "button", "image", "reset"}
_EMAIL = re.compile(r"e-?mail", re.IGNORECASE)
_PHONE = re.compile(r"phone|mobile|\bcell\b|\btel\b|telephone", re.IGNORECASE)
_FIRST = re.compile(r"first[ _-]?name|fname|given[ _-]?name|forename", re.IGNORECASE)
_LAST = re.compile(r"last[ _-]?name|lname|surname|family[ _-]?name", re.IGNORECASE)
_COMPANY = re.compile(r"company|organi[sz]ation|business[ _-]?name|firm|employer", re.IGNORECASE)
_FULL_NAME = re.compile(r"\bname\b|full[ _-]?name|your[ _-]?name", re.IGNORECASE)
_MESSAGE = re.compile(r"message|comments?|notes?|tell us|how can we help|questions?|inquiry|enquiry", re.IGNORECASE)
_CAPTCHA_FIELD = re.compile(r"captcha|not a robot|i am human|verify you", re.IGNORECASE)
_INDUSTRY_LABEL = re.compile(r"industr|categor|interest|type of business|sector|looking for|business type", re.IGNORECASE)
_HEARD = re.compile(r"hear|source|referr|found us", re.IGNORECASE)
_HEARD_OPTION = re.compile(r"internet|online|web|search|google|other", re.IGNORECASE)
_ROLE = re.compile(r"\bi am\b|i'm a|you are|\brole\b|describes you|are you a", re.IGNORECASE)
_ROLE_OPTION = re.compile(r"buyer|investor|acquir|purchas|looking to buy", re.IGNORECASE)
_ANY_OPTION = re.compile(r"^\s*(?:all|any)\b", re.IGNORECASE)
_PLACEHOLDER_OPTION = re.compile(r"^\s*(?:[-–—\s]*|select\b.*|choose\b.*|please\b.*)$", re.IGNORECASE)
_LEGAL = re.compile(r"\bnda\b|non-?disclosure|confidential|\bterms\b|conditions|privacy|policy|disclaimer|waiver|i have read", re.IGNORECASE)
_MARKETING = re.compile(r"receive|subscribe|newsletter|alerts?|updates?|e-?mail|marketing|notify|notifications?|promotional|listings?", re.IGNORECASE)


def _text(f: dict[str, Any]) -> str:
    return " ".join(str(f.get(k) or "") for k in ("label", "name", "id", "placeholder"))


def _required(f: dict[str, Any]) -> bool:
    return bool(f.get("required")) or str(f.get("label") or "").rstrip().endswith("*")


def _name_of(f: dict[str, Any]) -> str:
    return (str(f.get("label") or "") or str(f.get("placeholder") or "") or str(f.get("name") or "field")).replace("*", "").strip()[:60] or "a field"


def _real_options(f: dict[str, Any]) -> list[dict[str, str]]:
    return [o for o in f.get("options") or [] if (o.get("value") or "").strip() and not _PLACEHOLDER_OPTION.match(o.get("text") or "")]


def plan_form(fields: list[dict[str, Any]], buyer: Buyer, industries: list[str], address: str) -> FormPlan:
    plan = FormPlan()
    wanted = industry_pattern(industries)
    note = "Interested in buying a business" + (f" ({', '.join(industries[:4])})" if industries else "") + ". Signing up for listing alerts."

    def stop(reason: str) -> FormPlan:
        plan.manual_reason = reason
        plan.steps = []
        return plan

    radios: dict[str, list[dict[str, Any]]] = {}
    for f in fields:
        ftype, tag = f.get("type") or "", f.get("tag") or "input"
        if f.get("isEmail") or ftype in _SKIP_TYPES:
            continue
        text = _text(f)
        if ftype == "password":
            return stop("The site asks you to create a password / account.")
        if ftype == "file":
            return stop("The site asks for a file upload.")
        if not f.get("visible"):
            continue  # invisible fields (honeypots included) are never filled
        sel = f'[data-tagr-i="{f["i"]}"]'
        required = _required(f)
        if _CAPTCHA_FIELD.search(text):
            return stop("The form has a captcha / human check.")

        if ftype == "radio":
            radios.setdefault(str(f.get("name") or f["i"]), []).append(f)
            continue

        if ftype == "checkbox":
            label = str(f.get("label") or "")
            if _LEGAL.search(label):
                if required:
                    return stop(f"The site requires accepting: “{label[:90]}”. That is for a person to accept.")
            elif wanted is not None and wanted.search(label) or _MARKETING.search(label):
                plan.steps.append(FormStep("check", sel))
            elif required:
                return stop(f"The site requires ticking: “{label[:90]}”.")
            continue

        if tag == "select":
            options = _real_options(f)
            if f.get("value") and any(o["value"] == f["value"] for o in options):
                continue  # already on a real choice
            choice: str | None = None
            if _ROLE.search(text):
                choice = next((o["value"] for o in options if _ROLE_OPTION.search(o["text"])), None)
            elif _INDUSTRY_LABEL.search(text):
                choice = next((o["value"] for o in options if wanted is not None and wanted.search(o["text"])), None) or next(
                    (o["value"] for o in options if _ANY_OPTION.match(o["text"])), None
                )
            elif _HEARD.search(text):
                choice = next((o["value"] for o in options if _HEARD_OPTION.search(o["text"])), None)
            if choice is not None:
                plan.steps.append(FormStep("select", sel, choice))
            elif required:
                return stop(f"The site requires choosing “{_name_of(f)}” and none of the options is a safe fit.")
            continue

        # text-like input / textarea
        if ftype == "email" or _EMAIL.search(text):
            plan.steps.append(FormStep("fill", sel, address))  # a "confirm your email" field
            continue
        value: str | None
        if ftype == "tel" or _PHONE.search(text):
            value, what = buyer.phone, "phone number"
        elif _FIRST.search(text):
            value, what = buyer.first_name, "first name"
        elif _LAST.search(text):
            value, what = buyer.last_name, "last name"
        elif _COMPANY.search(text):
            value, what = buyer.company, "company"
        elif _FULL_NAME.search(text):
            value, what = buyer.name, "name"
        elif tag == "textarea" or _MESSAGE.search(text):
            value, what = (note if required else None), "message"
        else:
            value, what = None, _name_of(f)
        if value:
            plan.steps.append(FormStep("fill", sel, value))
        elif required:
            return stop(f"The site requires your {what}, which is not configured (or not something to make up).")

    for name, group in radios.items():
        label_of = lambda r: str(r.get("label") or "")  # noqa: E731
        pick = None
        group_text = " ".join(label_of(r) for r in group)
        if _ROLE.search(group_text):
            pick = next((r for r in group if _ROLE_OPTION.search(label_of(r))), None)
        if pick is None and wanted is not None:
            pick = next((r for r in group if wanted.search(label_of(r))), None)
        if pick is not None:
            plan.steps.append(FormStep("check", f'[data-tagr-i="{pick["i"]}"]'))
        elif any(_required(r) for r in group) and not any(r.get("checked") for r in group):
            return stop(f"The site requires choosing an option for “{_name_of(group[0])}”.")
    return plan
