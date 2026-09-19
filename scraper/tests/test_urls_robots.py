import httpx

from leadengine.util.robots import RobotsCache
from leadengine.util.urls import host_of, is_aggregator, is_public_http_url, normalize_url


def test_normalize_url_strips_noise():
    assert normalize_url("HTTPS://www.Example.com/About/?utm=1#x") == "https://example.com/About"


def test_aggregators():
    assert is_aggregator("https://www.yelp.com/biz/foo")
    assert is_aggregator("https://m.facebook.com/foo")
    assert not is_aggregator("https://coolairphoenix.com")
    assert host_of("https://www.coolairphoenix.com/x") == "coolairphoenix.com"


def test_non_public_urls_rejected():
    assert not is_public_http_url("http://localhost:8000/admin")
    assert not is_public_http_url("http://127.0.0.1/")
    assert not is_public_http_url("http://169.254.169.254/latest/meta-data")
    assert not is_public_http_url("ftp://example.com/file")
    assert not is_public_http_url("file:///etc/passwd")


def _robots(status: int, body: str = ""):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=body)

    return RobotsCache(httpx.Client(transport=httpx.MockTransport(handler)), "TagrLeadEngine/1.0")


def test_robots_disallow_rule_respected():
    robots = _robots(200, "User-agent: *\nDisallow: /private/")
    assert robots.allowed("https://site.test/public")
    assert not robots.allowed("https://site.test/private/x")


def test_robots_404_means_allowed():
    assert _robots(404).allowed("https://site.test/anything")


def test_robots_server_error_means_disallowed():
    assert not _robots(503).allowed("https://site.test/anything")
