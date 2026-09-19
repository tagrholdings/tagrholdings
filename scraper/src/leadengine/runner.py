"""Orchestrates one run of one search profile.

  profile -> plan of (source, search term) pairs -> for each candidate a source finds:
      already known? skip (no paid work)  ->  enrich from its website  ->  AI extraction  ->  insert

Two stop conditions, with different meanings for the schedule:
  * lead cap reached  -> the run did its period's work: `last_run_at` is stamped, the cursor kept, so the
                         profile waits its `frequency_hours` and then continues where it left off;
  * time limit hit    -> the run was cut short: `resume` is set and `last_run_at` left alone, so the very
                         next scheduler tick picks the profile up again.
A cycle that completes clears the cursor and starts over next period.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from .criteria import match_signals
from .db import Database
from .enrich.company_site import CompanySiteScraper
from .enrich.email_signup_detect import EmailSignupDetection, detect_email_only_signup
from .extraction.extractor import Extractor, fields_from_hints_only
from .models import (
    DISCOVERY_SOURCES,
    SOURCE_BROKER_LISTINGS,
    SOURCE_COMPANY_SITE,
    Candidate,
    RawLead,
    SearchProfile,
    UsageEvent,
)
from .sources.base import Source, SourceContext, SourceError, SourceNotConfigured
from .util.urls import registrable_domain

log = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 12_000


class _Stop(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason  # "cap" | "deadline"


class SiteEnricher(Protocol):
    def scrape(self, website: str): ...


@dataclass
class _Counters:
    seen: int = 0
    added: int = 0
    # New "listings by email signup" sites logged into email_sources this run (see _log_email_source).
    email_sources: int = 0
    # Domains already looked up this run (logged or found tracked): each is checked once, not per page visited.
    checked_domains: set[str] = field(default_factory=set)


@dataclass
class RunResult:
    run_id: str
    status: str
    candidates_seen: int
    leads_added: int
    stop_reason: str | None
    errors: list[str]
    email_sources_detected: int = 0


class Runner:
    def __init__(
        self,
        db: Database,
        sources: dict[str, Source],
        extractor: Extractor | None,
        enricher: CompanySiteScraper | SiteEnricher | None,
        make_context: Callable[[dict[str, Any], Callable[[UsageEvent], None]], SourceContext],
        deadline: float | None = None,
        max_leads_override: int | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._db = db
        self._sources = sources
        self._extractor = extractor
        self._enricher = enricher
        self._make_context = make_context
        self._deadline = deadline
        self._max_leads_override = max_leads_override
        self._clock = clock

    # -- planning ------------------------------------------------------------

    @staticmethod
    def plan(profile: SearchProfile) -> list[tuple[str, str]]:
        """Every (source, term) pair this profile searches this cycle, in a stable order."""
        plan: list[tuple[str, str]] = []
        for src in DISCOVERY_SOURCES:
            if not profile.source_enabled(src):
                continue
            # The broker crawler reads each site ONCE for all the profile's industries — running it per term would open
            # every broker N times — so it is a single step.
            plan += [(src, "*")] if src == SOURCE_BROKER_LISTINGS else [(src, term) for term in profile.terms]
        return plan

    @staticmethod
    def _resume_index(plan: list[tuple[str, str]], cursor: dict[str, Any] | None) -> int:
        if not cursor:
            return 0
        pair = (cursor.get("source"), cursor.get("term"))
        # A cursor pointing at a pair the profile no longer has (edited mid-cycle) -> start over.
        return plan.index(pair) if pair in plan else 0  # type: ignore[arg-type]

    def _past_deadline(self) -> bool:
        return self._deadline is not None and self._clock() >= self._deadline

    # -- one profile ---------------------------------------------------------

    def run_profile(self, profile: SearchProfile) -> RunResult:
        run_id = self._db.start_run(profile)

        def record_usage(event: UsageEvent) -> None:
            # Written immediately, not batched: a crash mid-run must not lose the record of money already spent.
            self._db.record_usage(profile.tenant_id, run_id, event)

        state = dict(profile.run_state)
        ctx = self._make_context(state, record_usage)
        ctx.store = self._db  # the listing-sites list, for sources that crawl broker sites
        counters = _Counters()
        # A page a source visited expecting listings but found none (e.g. the marketplace): a signup-only site?
        ctx.on_empty_page = lambda html, url: self._log_email_source(profile, detect_email_only_signup(html, url), counters)
        cap = profile.max_leads_per_run
        if self._max_leads_override is not None:
            cap = min(cap, self._max_leads_override)

        plan = self.plan(profile)
        errors: list[str] = []
        stop: _Stop | None = None
        stopped_at: tuple[str, str] | None = None
        fatal: str | None = None

        try:
            for src_type, term in plan[self._resume_index(plan, state.get("cursor")) :]:
                stopped_at = (src_type, term)
                if self._past_deadline():
                    raise _Stop("deadline")
                source = self._sources.get(src_type)
                if source is None:
                    continue
                pages = source.search(profile, term, ctx)
                try:
                    for page in pages:
                        self._process_page(profile, page, src_type, counters, cap, record_usage)
                        if self._past_deadline():
                            raise _Stop("deadline")
                except SourceNotConfigured as exc:
                    log.warning("Skipping %s: %s", src_type, exc)
                    if f"{src_type}: {exc}" not in errors:
                        errors.append(f"{src_type}: {exc}")
                except _Stop:
                    raise
                except SourceError as exc:
                    log.warning("%s failed for %r: %s", src_type, term, exc)
                    errors.append(f"{src_type} ({term}): {exc}")
                finally:
                    pages.close()  # release a browser/session if we stopped mid-source
        except _Stop as exc:
            stop = exc
        except Exception as exc:  # noqa: BLE001 - one profile's crash must not stop the others
            log.exception("Run for profile %s crashed", profile.id)
            fatal = f"{type(exc).__name__}: {exc}"

        # -- settle the run and the checkpoint --------------------------------
        new_state = dict(ctx.state)  # keeps the geocode cache the sources wrote
        if fatal:
            status, mark_ran = "failed", False
            new_state.pop("resume", None)
        elif stop and stop.reason == "deadline":
            status, mark_ran = "partial", False
            new_state["cursor"] = {"source": stopped_at[0], "term": stopped_at[1]} if stopped_at else None
            new_state["resume"] = True
        elif stop and stop.reason == "cap":
            status, mark_ran = ("partial" if errors else "completed"), True
            new_state["cursor"] = {"source": stopped_at[0], "term": stopped_at[1]} if stopped_at else None
            new_state["resume"] = False
        else:
            status, mark_ran = ("partial" if errors else "completed"), True
            new_state.pop("cursor", None)
            new_state["resume"] = False

        error_text = fatal or ("; ".join(errors) if errors else None)
        self._db.finish_run(
            profile.tenant_id, run_id, status, counters.seen, counters.added, error_text,
            email_sources_detected=counters.email_sources,
        )
        if not fatal:
            self._db.save_profile_state(profile, new_state, mark_ran)
        return RunResult(
            run_id, status, counters.seen, counters.added, stop.reason if stop else None, errors, counters.email_sources
        )

    # -- email-only sites ------------------------------------------------------

    def _log_email_source(self, profile: SearchProfile, detection: EmailSignupDetection | None, counters: _Counters) -> None:
        """Logs a detected signup-only site into `email_sources` - and nothing more.

        No signup is attempted here (email_signup.py does that on its own pass), no raw lead is created, and it never
        raises: a failure here must not cost the run a lead. Each domain is looked up once per run; the database
        check (`record_email_source_detection`) is what guarantees a domain is never logged twice across runs.
        """
        if detection is None:
            return
        domain = registrable_domain(detection.page_url)
        if not domain or domain in counters.checked_domains:
            return
        counters.checked_domains.add(domain)
        notes = f"Auto-detected during search profile run \"{profile.name}\" on {datetime.now(timezone.utc):%Y-%m-%d}."
        try:
            created = self._db.record_email_source_detection(profile.tenant_id, detection, notes)
        except Exception:  # noqa: BLE001
            log.exception("Could not log email-only source %s", detection.page_url)
            return
        if created:
            counters.email_sources += 1
            log.info("New email-only source detected: %s (%s)", detection.site_name, detection.page_url)

    # -- one page of candidates ---------------------------------------------

    def _process_page(
        self,
        profile: SearchProfile,
        page: list[Candidate],
        source_type: str,
        counters: _Counters,
        cap: int,
        record_usage: Callable[[UsageEvent], None],
    ) -> None:
        """Handles one page, updating `counters` as it goes so a stop mid-page still reports true numbers."""
        counters.seen += len(page)
        known = self._db.existing_keys(profile.tenant_id, source_type, [c.dedupe_key for c in page])
        for candidate in page:
            if candidate.dedupe_key in known:
                continue  # already in the inbox (or dismissed) — no enrichment, no AI spend
            if counters.added >= cap:
                raise _Stop("cap")
            if self._past_deadline():
                raise _Stop("deadline")
            lead = self._build_lead(profile, candidate, record_usage, counters)
            if self._db.insert_lead(profile, lead):
                counters.added += 1
        if counters.added >= cap:
            raise _Stop("cap")

    def _lead_from_prefilled(self, profile: SearchProfile, candidate: Candidate) -> RawLead:
        """A candidate whose fields the source already extracted (a broker's listing): saved as-is — no website to
        enrich, no second AI call."""
        fields = dict(candidate.fields or {})
        raw_text = (candidate.text or "")[:MAX_RAW_TEXT_CHARS]
        matched = match_signals(
            profile.criteria, raw_text, fields.get("summary"), fields.get("reasonForSelling"), fields.get("businessName")
        )
        if matched:
            fields["matchedSignals"] = matched
        return RawLead(
            source_type=candidate.source_type,
            dedupe_key=candidate.dedupe_key,
            business_name=fields.get("businessName") or candidate.business_name,
            source_url=candidate.source_url,
            raw_text=raw_text,
            extracted_fields=fields,
        )

    def _build_lead(
        self,
        profile: SearchProfile,
        candidate: Candidate,
        record_usage: Callable[[UsageEvent], None],
        counters: _Counters,
    ) -> RawLead:
        if candidate.fields is not None:
            return self._lead_from_prefilled(profile, candidate)
        text_parts = [candidate.text]
        if candidate.website:
            candidate.hints.setdefault("website", candidate.website)

        if candidate.website and self._enricher and profile.source_enabled(SOURCE_COMPANY_SITE):
            try:
                site = self._enricher.scrape(candidate.website)
            except Exception:  # noqa: BLE001 - a broken website must never lose the lead
                log.exception("Website enrichment failed for %s", candidate.website)
                site = None
            if site is not None:
                # The lead below is built exactly as before; a signup-only page just also gets logged as an email source.
                self._log_email_source(profile, getattr(site, "email_signup", None), counters)
                if site.emails:
                    candidate.hints.setdefault("email", site.emails[0])
                    text_parts.append("Emails found on website: " + ", ".join(site.emails))
                if site.phones:
                    candidate.hints.setdefault("phone", site.phones[0])
                    text_parts.append("Phones found on website: " + ", ".join(site.phones))
                if site.text:
                    text_parts.append("Website text: " + site.text)

        raw_text = "\n\n".join(p for p in text_parts if p)[:MAX_RAW_TEXT_CHARS]

        fields: dict[str, Any] | None = None
        if self._extractor is not None:
            try:
                extraction = self._extractor.extract(candidate, raw_text)
                fields = extraction.fields
                if extraction.usage is not None:
                    record_usage(extraction.usage)
            except Exception:  # noqa: BLE001 - the lead is still worth keeping without AI fields
                log.exception("Extraction failed for %r — keeping the source's own fields.", candidate.business_name)
        if fields is None:
            fields = fields_from_hints_only(candidate)

        # Signal keywords from the profile's criteria, matched against everything the job read (not just the AI's summary).
        matched = match_signals(profile.criteria, raw_text, fields.get("summary"), fields.get("reasonForSelling"))
        if matched:
            fields["matchedSignals"] = matched

        return RawLead(
            source_type=candidate.source_type,
            dedupe_key=candidate.dedupe_key,
            business_name=(fields.get("businessName") or candidate.business_name),
            source_url=candidate.source_url,
            raw_text=raw_text,
            extracted_fields=fields,
        )
