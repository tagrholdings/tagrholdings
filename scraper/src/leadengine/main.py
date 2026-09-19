"""Entry point:  python -m leadengine.main [--max-minutes N] [--profile-id UUID] [--force] [--max-leads N]

One invocation = one pass over every search profile that is due, then exit. The
scheduler (GitHub Actions cron today, a server loop later) just calls it again.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Any

import httpx
from dotenv import load_dotenv

from .config import ConfigError, Settings, load_settings
from .db import Database
from .enrich.company_site import CompanySiteScraper
from .extraction.extractor import OpenAIExtractor
from .models import SOURCE_BRAVE, SOURCE_GOOGLE_PLACES, SOURCE_MARKETPLACE
from .runner import Runner
from .sources.base import SourceContext
from .sources.brave_search import BraveSearchSource
from .sources.google_places import GooglePlacesSource
from .sources.marketplace.bizbuysell import BizBuySellSource
from .util.ratelimit import DomainThrottle
from .util.robots import RobotsCache

log = logging.getLogger("leadengine")

# Leave headroom under --max-minutes so the final DB writes (finish_run, checkpoint) always happen.
_SAFETY_SECONDS = 45


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="leadengine", description="Tagr lead-discovery engine")
    parser.add_argument("--max-minutes", type=float, default=None, help="Stop starting new work after this long (checkpoint is saved).")
    parser.add_argument("--profile-id", action="append", default=None, help="Run only this search profile (repeatable). Implies --force.")
    parser.add_argument("--force", action="store_true", help="Run every active profile even if it isn't due yet.")
    parser.add_argument("--max-leads", type=int, default=None, help="Lower the per-run new-lead cap (never raises it) — handy for cheap test runs.")
    return parser.parse_args(argv)


def build_runner(settings: Settings, db: Database, http: httpx.Client, deadline: float | None, max_leads: int | None) -> Runner:
    robots = RobotsCache(http, settings.user_agent)
    throttle = DomainThrottle(min_interval=3.0, jitter=2.0)

    def make_context(state: dict[str, Any], record_usage: Any) -> SourceContext:
        return SourceContext(settings=settings, http=http, robots=robots, throttle=throttle, record_usage=record_usage, state=state)

    extractor = OpenAIExtractor(settings) if settings.openai_api_key else None
    if extractor is None:
        log.warning("OPENAI_API_KEY is not set — leads will be saved with the sources' own fields only (no AI extraction).")

    return Runner(
        db=db,
        sources={
            SOURCE_GOOGLE_PLACES: GooglePlacesSource(),
            SOURCE_BRAVE: BraveSearchSource(),
            SOURCE_MARKETPLACE: BizBuySellSource(),
        },
        extractor=extractor,
        enricher=CompanySiteScraper(http, robots, DomainThrottle(min_interval=1.5, jitter=1.0)),
        make_context=make_context,
        deadline=deadline,
        max_leads_override=max_leads,
    )


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    # httpx logs every request URL at INFO — and Google's APIs take the key as a query parameter.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    load_dotenv()  # local runs: scraper/.env; in CI/Docker the variables are already set
    args = parse_args(argv)

    try:
        settings = load_settings()
    except ConfigError as exc:
        log.error("%s", exc)
        return 2

    deadline = None
    if args.max_minutes is not None:
        deadline = time.monotonic() + max(args.max_minutes * 60 - _SAFETY_SECONDS, 0)

    db = Database(settings.database_url)
    try:
        if not db.try_lock():
            log.warning("Another engine run holds the lock — exiting.")
            return 0

        profiles = db.due_profiles(only_ids=args.profile_id, force=args.force or bool(args.profile_id))
        log.info("%d search profile(s) due.", len(profiles))

        with httpx.Client(headers={"User-Agent": settings.user_agent}) as http:
            runner = build_runner(settings, db, http, deadline, args.max_leads)
            failed = 0
            for profile in profiles:
                if deadline is not None and time.monotonic() >= deadline:
                    log.info("Time limit reached — remaining profiles wait for the next run.")
                    break
                log.info("Running profile %r (%s, %s)…", profile.name, profile.city, profile.state)
                result = runner.run_profile(profile)
                log.info(
                    "Profile %r: %s — %d seen, %d new leads%s%s",
                    profile.name,
                    result.status,
                    result.candidates_seen,
                    result.leads_added,
                    f", {result.email_sources_detected} new email-only source(s) detected" if result.email_sources_detected else "",
                    f", stopped: {result.stop_reason}" if result.stop_reason else "",
                )
                for error in result.errors:
                    log.warning("  %s", error)
                failed += result.status == "failed"
        return 1 if failed else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
