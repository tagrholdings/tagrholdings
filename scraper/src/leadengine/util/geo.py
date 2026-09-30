"""Where is a listing, relative to the profile's city + radius?

Broker listings rarely give an exact address: often just "Phoenix Metro", "Maricopa County" or "Arizona" (many are
confidential), and Mesa / Tempe / Scottsdale are "Phoenix" for a buyer. So the answer is a TIER, not yes/no:

  local    city geocoded inside the profile's radius
  region   same state, but only a region/state was stated or the city couldn't be placed — plausible, not confirmed
  state    same state, city placed OUTSIDE the radius (Tucson for a Phoenix profile)
  unknown  the listing states no location at all
  outside  another state or country

`keeps()` maps a tier to the profile's `location_scope` (radius | state | anywhere). Nothing here is billed unless a
city has to be geocoded: only cities of the profile's own state are, and each is cached in the run state.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any

import httpx

from ..models import UsageEvent
from ..pricing import GOOGLE_GEOCODING_USD

log = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
MAX_GEOCODES_PER_RUN = 40  # spend guard: a run reads a few hundred listings at most, mostly in a handful of cities

LOCAL, REGION, STATE, UNKNOWN, OUTSIDE = "local", "region", "state", "unknown", "outside"

SCOPE_RADIUS, SCOPE_STATE, SCOPE_ANYWHERE = "radius", "state", "anywhere"
_KEPT = {
    SCOPE_RADIUS: {LOCAL, REGION, UNKNOWN},
    SCOPE_STATE: {LOCAL, REGION, STATE, UNKNOWN},
    SCOPE_ANYWHERE: {LOCAL, REGION, STATE, UNKNOWN, OUTSIDE},
}

US_STATES = {
    "AL": "alabama", "AK": "alaska", "AZ": "arizona", "AR": "arkansas", "CA": "california", "CO": "colorado",
    "CT": "connecticut", "DE": "delaware", "DC": "district of columbia", "FL": "florida", "GA": "georgia",
    "HI": "hawaii", "ID": "idaho", "IL": "illinois", "IN": "indiana", "IA": "iowa", "KS": "kansas",
    "KY": "kentucky", "LA": "louisiana", "ME": "maine", "MD": "maryland", "MA": "massachusetts",
    "MI": "michigan", "MN": "minnesota", "MS": "mississippi", "MO": "missouri", "MT": "montana",
    "NE": "nebraska", "NV": "nevada", "NH": "new hampshire", "NJ": "new jersey", "NM": "new mexico",
    "NY": "new york", "NC": "north carolina", "ND": "north dakota", "OH": "ohio", "OK": "oklahoma",
    "OR": "oregon", "PA": "pennsylvania", "RI": "rhode island", "SC": "south carolina", "SD": "south dakota",
    "TN": "tennessee", "TX": "texas", "UT": "utah", "VT": "vermont", "VA": "virginia", "WA": "washington",
    "WV": "west virginia", "WI": "wisconsin", "WY": "wyoming",
}
_NAME_TO_CODE = {name: code for code, name in US_STATES.items()}
_NOT_US = re.compile(r"\b(canada|mexico|uk|united kingdom|australia|ontario|british columbia|alberta|quebec)\b", re.IGNORECASE)
_REGION_WORDS = re.compile(r"\b(metro|area|county|valley|region|greater|surrounding)\b", re.IGNORECASE)


def state_code(value: str | None) -> str | None:
    """'AZ', 'az', 'Arizona' and 'Phoenix, AZ' all -> 'AZ'; anything unrecognised -> None."""
    if not value:
        return None
    text = re.sub(r"[.]", "", value.strip()).lower()
    if not text:
        return None
    if text.upper() in US_STATES:
        return text.upper()
    if text in _NAME_TO_CODE:
        return _NAME_TO_CODE[text]
    tail = re.split(r"[,\s]+", text)[-1].upper()
    if tail in US_STATES and "," in value:
        return tail
    for name, code in _NAME_TO_CODE.items():
        if re.search(rf"\b{re.escape(name)}\b", text):
            return code
    return None


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(a))


def keeps(scope: str, tier: str) -> bool:
    return tier in _KEPT.get(scope, _KEPT[SCOPE_RADIUS])


class Geo:
    """Classifies listings against one profile. Geocodes cities (cached in `cache`, which the runner persists)."""

    def __init__(self, ctx: Any, city: str, state: str, radius_miles: int) -> None:
        self._ctx = ctx
        self._state = state_code(state)
        self._city = city.strip().lower()
        self._radius = radius_miles
        self._cache: dict[str, Any] = ctx.state.setdefault("geo_cache", {})
        self._calls = 0
        self._center = self._geocode(f"{city}, {state}") if ctx.settings.google_api_key else None

    def classify(self, location: dict[str, Any] | None) -> str:
        location = location or {}
        city = str(location.get("city") or "").strip()
        state_text = str(location.get("state") or "").strip()
        address = str(location.get("address") or "").strip()
        blob = " ".join(part for part in (city, state_text, address) if part)
        if not blob:
            return UNKNOWN
        if _NOT_US.search(blob):
            return OUTSIDE

        code = state_code(state_text) or state_code(address) or (state_code(city) if "," in city else None)
        if code is None:
            # No recognisable state: a city that IS the profile's city still counts; otherwise we can't tell.
            return LOCAL if city.lower() == self._city else UNKNOWN
        if self._state is not None and code != self._state:
            return OUTSIDE

        # Same state. Only a real city can be placed; "Phoenix Metro" / "Maricopa County" / the bare state can't.
        if not city or state_code(city) == code or _REGION_WORDS.search(city):
            return LOCAL if city and city.lower().startswith(self._city) else REGION
        if city.lower() == self._city:
            return LOCAL
        point = self._geocode(f"{city}, {code}") if self._center else None
        if point is None or self._center is None:
            return REGION
        miles = haversine_miles(self._center["lat"], self._center["lng"], point["lat"], point["lng"])
        return LOCAL if miles <= self._radius else STATE

    # -- geocoding ---------------------------------------------------------------------------------------------------

    def _geocode(self, address: str) -> dict[str, float] | None:
        key = address.lower()
        if key in self._cache:
            return self._cache[key]  # None is cached too: a city Google can't place isn't asked again
        if self._calls >= MAX_GEOCODES_PER_RUN:
            return None
        self._calls += 1
        try:
            response = self._ctx.http.get(GEOCODE_URL, params={"address": address, "key": self._ctx.settings.google_api_key}, timeout=20)
        except httpx.HTTPError as exc:
            log.warning("Geocoding %r failed (%s) — treating it as unplaced.", address, exc)
            return None
        body = response.json() if response.status_code == 200 else {}
        status = body.get("status", f"HTTP {response.status_code}")
        if status not in ("OK", "ZERO_RESULTS"):
            log.warning("Geocoding %s for %r (%s).", status, address, (body.get("error_message") or "")[:120])
            return None  # rejected calls aren't billed and aren't cached (a later run may have the API enabled)
        self._ctx.record_usage(UsageEvent(provider="google_geocoding", operation="geocode", cost_usd=GOOGLE_GEOCODING_USD))
        results = body.get("results") or []
        point = None
        if results:
            loc = results[0]["geometry"]["location"]
            point = {"lat": loc["lat"], "lng": loc["lng"]}
        self._cache[key] = point
        return point
