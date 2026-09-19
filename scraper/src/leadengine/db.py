"""All Postgres access for the engine.

Connects as the `lead_scraper` role (drizzle/0006 + 0008), which has NO
BYPASSRLS. Every write happens in a short transaction that first sets
`app.tenant_id` (from the search profile being processed), so the row-level
security policies hold the job to that tenant even if this code had a bug.
The only cross-tenant thing it can do is READ active search profiles.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .models import RawLead, SearchProfile, UsageEvent

log = logging.getLogger(__name__)

# One session-level advisory lock: only one engine process may run at a time
# (a second GitHub Actions run, or the server loop overlapping a manual run).
_ADVISORY_LOCK_ID = 727_001


class Database:
    def __init__(self, dsn: str) -> None:
        # autocommit: transactions are opened explicitly, per tenant, below.
        self._conn = psycopg.connect(dsn, autocommit=True, row_factory=dict_row)

    def close(self) -> None:
        self._conn.close()

    def try_lock(self) -> bool:
        row = self._conn.execute("select pg_try_advisory_lock(%s) as locked", (_ADVISORY_LOCK_ID,)).fetchone()
        return bool(row and row["locked"])

    @contextmanager
    def _tenant(self, tenant_id: str) -> Iterator[psycopg.Connection[dict[str, Any]]]:
        with self._conn.transaction():
            self._conn.execute("select set_config('app.tenant_id', %s, true)", (tenant_id,))
            yield self._conn

    # -- profiles ------------------------------------------------------------

    def due_profiles(self, only_ids: list[str] | None = None, force: bool = False) -> list[SearchProfile]:
        """Active profiles that should run now: never run, past their frequency,
        or stopped early last time (`run_state.resume`)."""
        rows = self._conn.execute(
            """
            select id::text, tenant_id::text, name, category, keywords, city, state, radius_miles,
                   sources, max_leads_per_run, frequency_hours, run_state, last_run_at, criteria, run_requested_at
            from search_profiles
            where active
              and (%(force)s
                   or last_run_at is null
                   or run_requested_at is not null
                   or last_run_at + make_interval(hours => frequency_hours) <= now()
                   or coalesce((run_state->>'resume')::boolean, false))
              and (%(ids)s::uuid[] is null or id = any(%(ids)s::uuid[]))
            order by last_run_at nulls first, created_at
            """,
            {"force": force, "ids": only_ids},
        ).fetchall()
        return [
            SearchProfile(
                id=r["id"],
                tenant_id=r["tenant_id"],
                name=r["name"],
                category=r["category"],
                keywords=list(r["keywords"] or []),
                city=r["city"],
                state=r["state"],
                radius_miles=r["radius_miles"],
                sources=dict(r["sources"] or {}),
                max_leads_per_run=r["max_leads_per_run"],
                frequency_hours=r["frequency_hours"],
                run_state=dict(r["run_state"] or {}),
                last_run_at=r["last_run_at"],
                criteria=dict(r["criteria"]) if r["criteria"] else None,
                run_requested_at=r["run_requested_at"],
            )
            for r in rows
        ]

    def save_profile_state(self, profile: SearchProfile, run_state: dict[str, Any], mark_ran: bool) -> None:
        """Persist the checkpoint. `mark_ran` also stamps last_run_at (the run did its
        period's work — finished the cycle or hit its lead cap); a run cut short by the
        time limit leaves it alone so the profile is picked up again right away."""
        with self._tenant(profile.tenant_id) as conn:
            conn.execute(
                """
                update search_profiles
                set run_state = %s,
                    last_run_at = case when %s then now() else last_run_at end
                where id = %s and tenant_id = %s
                """,
                (Jsonb(run_state), mark_ran, profile.id, profile.tenant_id),
            )

    # -- email sources (auto-signup) ------------------------------------------

    def record_email_source_detection(self, tenant_id: str, detection, notes: str) -> bool:
        """Logs a site found to offer listings only by email signup. True when a NEW row was created.

        Checked before inserting, against EVERY email source of the tenant (added by hand, auto-detected earlier,
        subscribed or not): a domain that is already tracked is left alone, so it is never logged twice - and never
        duplicated, which would also make the confirmation-email matcher refuse to guess between two rows.
        Rows are always created unsubscribed and not captcha-protected, `source = 'auto_detected'`; the database
        itself enforces that (column grants + the insert policy), not just this code.
        """
        from .util.urls import is_domain_tracked  # local: keeps db.py's import surface unchanged

        with self._tenant(tenant_id) as conn:
            existing = [
                r["signup_url"]
                for r in conn.execute("select signup_url from email_sources where tenant_id = %s", (tenant_id,)).fetchall()
            ]
            if is_domain_tracked(existing, detection.page_url):
                return False
            row = conn.execute(
                """
                insert into email_sources (tenant_id, site_name, signup_url, email_field_selector, submit_selector, notes, source)
                values (%s, %s, %s, %s, %s, %s, 'auto_detected')
                on conflict (tenant_id, signup_url) do nothing
                returning id
                """,
                (
                    tenant_id,
                    detection.site_name,
                    detection.page_url,
                    detection.email_field_selector,
                    detection.submit_selector,
                    notes,
                ),
            ).fetchone()
            return row is not None

    def due_email_sources(self, only_ids: list[str] | None = None):
        """Sources to try a signup for: waiting for a subscription, not captcha-protected, both selectors
        configured, and never attempted OR re-requested from the CRM ("Attempt subscribe")."""
        from .email_signup import SignupTarget  # local import: email_signup imports this module

        rows = self._conn.execute(
            """
            select id::text, tenant_id::text, site_name, signup_url, email_field_selector, submit_selector
            from email_sources
            where not subscribed and not captcha_protected
              and email_field_selector is not null and submit_selector is not null
              and (attempt_requested_at is not null or last_attempt_at is null)
              and (%(ids)s::uuid[] is null or id = any(%(ids)s::uuid[]))
            order by created_at
            """,
            {"ids": only_ids},
        ).fetchall()
        return [
            SignupTarget(
                id=r["id"],
                tenant_id=r["tenant_id"],
                site_name=r["site_name"],
                signup_url=r["signup_url"],
                email_field_selector=r["email_field_selector"],
                submit_selector=r["submit_selector"],
            )
            for r in rows
        ]

    def record_signup_attempt(self, target, result: str, error: str | None) -> None:
        """Records the outcome and consumes a pending request. NEVER touches `subscribed`: a submitted form is not a
        subscription — the site's confirmation email (handled by the CRM's inbound webhook) does that."""
        with self._tenant(target.tenant_id) as conn:
            conn.execute(
                """
                update email_sources
                set last_attempt_at = now(), last_attempt_result = %s, last_attempt_error = %s,
                    captcha_protected = captcha_protected or %s, attempt_requested_at = null, updated_at = now()
                where id = %s and tenant_id = %s
                """,
                (result, error[:500] if error else None, result == "captcha", target.id, target.tenant_id),
            )

    # -- runs ----------------------------------------------------------------

    def start_run(self, profile: SearchProfile) -> str:
        with self._tenant(profile.tenant_id) as conn:
            # Picking the run up consumes a "Run now" request; one made while this run is in progress re-queues.
            conn.execute(
                "update search_profiles set run_requested_at = null where id = %s and tenant_id = %s and run_requested_at is not null",
                (profile.id, profile.tenant_id),
            )
            row = conn.execute(
                "insert into lead_runs (tenant_id, search_profile_id) values (%s, %s) returning id::text",
                (profile.tenant_id, profile.id),
            ).fetchone()
        assert row is not None
        return row["id"]

    def finish_run(
        self,
        tenant_id: str,
        run_id: str,
        status: str,
        candidates_seen: int,
        leads_added: int,
        error: str | None,
        email_sources_detected: int = 0,
    ) -> None:
        with self._tenant(tenant_id) as conn:
            conn.execute(
                """
                update lead_runs
                set status = %s, finished_at = now(), candidates_seen = %s, leads_added = %s, error = %s,
                    email_sources_detected = %s
                where id = %s and tenant_id = %s
                """,
                (status, candidates_seen, leads_added, error[:2000] if error else None, email_sources_detected, run_id, tenant_id),
            )

    # -- leads ---------------------------------------------------------------

    def existing_keys(self, tenant_id: str, source_type: str, keys: list[str]) -> set[str]:
        if not keys:
            return set()
        with self._tenant(tenant_id) as conn:
            rows = conn.execute(
                "select dedupe_key from raw_leads where tenant_id = %s and source_type = %s and dedupe_key = any(%s)",
                (tenant_id, source_type, keys),
            ).fetchall()
        return {r["dedupe_key"] for r in rows}

    def insert_lead(self, profile: SearchProfile, lead: RawLead) -> bool:
        """Idempotent insert. Returns False when the lead already existed (unique on
        tenant + source + dedupe key), e.g. when a cut-short run is re-scanned."""
        with self._tenant(profile.tenant_id) as conn:
            row = conn.execute(
                """
                insert into raw_leads
                  (tenant_id, search_profile_id, source_type, source_url, business_name, raw_text,
                   extracted_fields, dedupe_key)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (tenant_id, source_type, dedupe_key) do nothing
                returning id
                """,
                (
                    profile.tenant_id,
                    profile.id,
                    lead.source_type,
                    lead.source_url,
                    lead.business_name[:300],
                    lead.raw_text,
                    Jsonb(lead.extracted_fields),
                    lead.dedupe_key,
                ),
            ).fetchone()
        return row is not None

    # -- spend ---------------------------------------------------------------

    def record_usage(self, tenant_id: str, run_id: str, event: UsageEvent) -> None:
        with self._tenant(tenant_id) as conn:
            conn.execute(
                """
                insert into lead_api_usage
                  (tenant_id, run_id, provider, operation, model, requests, input_tokens, output_tokens, cost_usd)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tenant_id,
                    run_id,
                    event.provider,
                    event.operation,
                    event.model,
                    event.requests,
                    event.input_tokens,
                    event.output_tokens,
                    round(event.cost_usd, 6),
                ),
            )
