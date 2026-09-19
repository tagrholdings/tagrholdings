from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

# Aggregators, social networks and directories: a search hit on these is never
# "the business's own website", so they are not useful candidates. (The business
# they describe usually also appears via Google Places.)
AGGREGATOR_DOMAINS = frozenset(
    {
        "yelp.com", "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com",
        "youtube.com", "pinterest.com", "reddit.com", "nextdoor.com", "wikipedia.org", "amazon.com",
        "yellowpages.com", "bbb.org", "mapquest.com", "angi.com", "angieslist.com", "thumbtack.com",
        "homeadvisor.com", "manta.com", "zoominfo.com", "dnb.com", "bizapedia.com", "opencorporates.com",
        "chamberofcommerce.com", "indeed.com", "glassdoor.com", "google.com", "maps.google.com",
        "bizbuysell.com", "bizquest.com", "businessbroker.net", "tripadvisor.com", "expertise.com",
    }
)


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


# Naive on purpose (no public-suffix list): enough to tell "bizlistings.com" from "othersite.com" and to fold
# "listings.bizlistings.co.uk" into "bizlistings.co.uk". Mirrors `registrableDomain` in
# modules/email-inbound/confirmation.ts — the confirmation-email matcher compares the very same notion.
_TWO_PART_TLDS = frozenset({"co.uk", "org.uk", "com.au", "co.nz", "com.br", "co.jp", "co.za", "com.mx"})


def registrable_domain(url_or_host: str) -> str:
    """"https://mail.www.Example.co.uk/x" -> "example.co.uk"; "" when there is no host."""
    host = host_of(url_or_host) if "://" in url_or_host else url_or_host.lower().removeprefix("www.")
    parts = [p for p in host.split(".") if p]
    if len(parts) <= 2:
        return ".".join(parts)
    return ".".join(parts[-3:] if ".".join(parts[-2:]) in _TWO_PART_TLDS else parts[-2:])


def is_domain_tracked(existing_urls: list[str], candidate_url: str) -> bool:
    """True when any already-tracked signup URL is on the same registrable domain as `candidate_url`."""
    wanted = registrable_domain(candidate_url)
    return bool(wanted) and any(registrable_domain(url) == wanted for url in existing_urls)


def is_aggregator(url: str) -> bool:
    host = host_of(url)
    return any(host == d or host.endswith("." + d) for d in AGGREGATOR_DOMAINS)


def normalize_url(url: str) -> str:
    """Stable form of a URL for dedupe: lowercase host, no www, no fragment/query, no trailing slash."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower().removeprefix("www.")
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower() or "https", host, path, "", ""))


def is_public_http_url(url: str) -> bool:
    """http(s) only, and the host must resolve exclusively to public addresses.

    The engine fetches URLs it found on the open web, so this keeps a hostile
    page (or a DNS trick) from pointing it at localhost or a private network.
    """
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80))
    except socket.gaierror:
        return False
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            return False
    return True
