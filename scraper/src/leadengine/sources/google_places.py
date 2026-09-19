"""Google Places API (New) — structured local-business search by category + area."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import httpx

from ..models import SOURCE_GOOGLE_PLACES, Candidate, SearchProfile, UsageEvent
from ..pricing import GOOGLE_GEOCODING_USD, GOOGLE_PLACES_TEXT_SEARCH_USD
from ..util.urls import normalize_url
from .base import SourceContext, SourceError, SourceNotConfigured

log = logging.getLogger(__name__)

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# The field mask decides both what comes back AND the billing tier: phone,
# website and rating are "Enterprise" fields (see pricing.py).
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.googleMapsUri",
        "places.businessStatus",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "nextPageToken",
    ]
)

PAGE_SIZE = 20
MAX_PAGES = 3  # Places returns at most 60 results per query
MAX_BIAS_RADIUS_METERS = 50_000  # API limit for a locationBias circle
METERS_PER_MILE = 1609.34


def _place_to_candidate(place: dict[str, Any]) -> Candidate | None:
    place_id = place.get("id")
    name = (place.get("displayName") or {}).get("text")
    if not place_id or not name:
        return None
    if place.get("businessStatus") in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"):
        return None

    # Google appends UTM tracking params to the website; they'd pollute the stored URL.
    website = normalize_url(place["websiteUri"]) if place.get("websiteUri") else None
    address = place.get("formattedAddress")
    phone = place.get("nationalPhoneNumber")
    types = [t.replace("_", " ") for t in place.get("types", []) if t not in ("point_of_interest", "establishment")]
    lines = [f"Business: {name}"]
    if address:
        lines.append(f"Address: {address}")
    if phone:
        lines.append(f"Phone: {phone}")
    if website:
        lines.append(f"Website: {website}")
    if types:
        lines.append(f"Google categories: {', '.join(types[:6])}")
    if place.get("rating") is not None:
        lines.append(f"Google rating: {place['rating']} ({place.get('userRatingCount', 0)} reviews)")

    return Candidate(
        source_type=SOURCE_GOOGLE_PLACES,
        dedupe_key=place_id,
        business_name=name,
        source_url=place.get("googleMapsUri"),
        website=website,
        text="\n".join(lines),
        hints={"address": address, "phone": phone, "industry": types[0] if types else None},
    )


class GooglePlacesSource:
    source_type = SOURCE_GOOGLE_PLACES

    def search(self, profile: SearchProfile, term: str, ctx: SourceContext) -> Iterator[list[Candidate]]:
        api_key = ctx.settings.google_api_key
        if not api_key:
            raise SourceNotConfigured("GOOGLE_CLOUD_API_KEY is not set.")

        center = self._geocode(profile, ctx, api_key)
        body: dict[str, Any] = {"textQuery": f"{term} in {profile.city}, {profile.state}", "pageSize": PAGE_SIZE}
        if center:
            body["locationBias"] = {
                "circle": {
                    "center": {"latitude": center["lat"], "longitude": center["lng"]},
                    "radius": min(profile.radius_miles * METERS_PER_MILE, MAX_BIAS_RADIUS_METERS),
                }
            }
        headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}

        for _ in range(MAX_PAGES):
            try:
                response = ctx.http.post(SEARCH_URL, json=body, headers=headers, timeout=30)
            except httpx.HTTPError as exc:
                raise SourceError(f"Places request failed: {exc}") from exc
            if response.status_code != 200:
                raise SourceError(f"Places API returned {response.status_code}: {response.text[:300]}")

            # Billed per request that reached Google and succeeded, not per business.
            ctx.record_usage(
                UsageEvent(provider="google_places", operation="text_search", cost_usd=GOOGLE_PLACES_TEXT_SEARCH_USD)
            )
            data = response.json()
            candidates = [c for c in (_place_to_candidate(p) for p in data.get("places", [])) if c]
            if candidates:
                yield candidates

            token = data.get("nextPageToken")
            if not token:
                return
            body = {**body, "pageToken": token}

    def _geocode(self, profile: SearchProfile, ctx: SourceContext, api_key: str) -> dict[str, float] | None:
        """City+state -> lat/lng, once per profile (cached in run_state so later runs pay nothing).

        The cache key includes the address so editing the profile's city invalidates it.
        """
        address = f"{profile.city}, {profile.state}"
        cached = ctx.state.get("geocode")
        if isinstance(cached, dict) and cached.get("address") == address and "lat" in cached:
            return {"lat": cached["lat"], "lng": cached["lng"]}

        try:
            response = ctx.http.get(GEOCODE_URL, params={"address": address, "key": api_key}, timeout=20)
        except httpx.HTTPError as exc:
            log.warning("Geocoding failed (%s) — searching without a location bias.", exc)
            return None

        # The Geocoding API answers HTTP 200 even for failures; the real outcome is in `status`.
        body = response.json() if response.status_code == 200 else {}
        status = body.get("status", f"HTTP {response.status_code}")
        if status not in ("OK", "ZERO_RESULTS"):
            # Rejected calls (API not enabled, bad key, quota) aren't billed — don't record them as spend.
            log.warning(
                "Geocoding %s (%s) — searching without a location bias. If the API is not enabled, enable "
                "'Geocoding API' for this key's Google Cloud project.",
                status,
                (body.get("error_message") or "")[:160],
            )
            return None

        ctx.record_usage(UsageEvent(provider="google_geocoding", operation="geocode", cost_usd=GOOGLE_GEOCODING_USD))
        results = body.get("results") or []
        if not results:
            log.warning("Geocoding found nothing for %r — searching without a location bias.", address)
            return None
        location = results[0]["geometry"]["location"]
        ctx.state["geocode"] = {"address": address, "lat": location["lat"], "lng": location["lng"]}
        return {"lat": location["lat"], "lng": location["lng"]}
