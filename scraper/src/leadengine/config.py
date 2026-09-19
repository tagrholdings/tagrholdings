"""Runtime configuration, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str
    google_api_key: str | None
    brave_api_key: str | None
    openai_api_key: str | None
    openai_model: str
    user_agent: str
    # The dedicated leads inbox the email signups subscribe with (e.g. leads@tagrholdings.com). Only email_signup needs it.
    inbound_leads_address: str | None = None
    # Optional overrides for the cost estimate of a model missing from pricing.py.
    openai_input_usd_per_million: float | None = None
    openai_output_usd_per_million: float | None = None


def _optional_float(name: str) -> float | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number, got {raw!r}") from exc


def load_settings() -> Settings:
    database_url = os.environ.get("DATABASE_URL_SCRAPER", "").strip()
    if not database_url:
        raise ConfigError("DATABASE_URL_SCRAPER is not set (connection string for the lead_scraper role).")
    return Settings(
        database_url=database_url,
        google_api_key=os.environ.get("GOOGLE_CLOUD_API_KEY", "").strip() or None,
        brave_api_key=os.environ.get("BRAVE_API_KEY", "").strip() or None,
        openai_api_key=os.environ.get("OPENAI_API_KEY", "").strip() or None,
        openai_model=os.environ.get("OPENAI_MODEL", "").strip() or "gpt-4o-mini",
        user_agent=os.environ.get("SCRAPER_USER_AGENT", "").strip()
        or "TagrLeadEngine/1.0 (+https://www.tagrholdings.com; business research)",
        inbound_leads_address=os.environ.get("INBOUND_LEADS_ADDRESS", "").strip() or None,
        openai_input_usd_per_million=_optional_float("OPENAI_INPUT_USD_PER_MILLION"),
        openai_output_usd_per_million=_optional_float("OPENAI_OUTPUT_USD_PER_MILLION"),
    )
