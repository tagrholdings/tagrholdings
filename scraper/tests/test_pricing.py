import pytest

from leadengine.pricing import gemini_cost_usd


def test_known_model_cost():
    # 1M in + 1M out on gemini-2.5-flash = $0.30 + $2.50
    assert gemini_cost_usd("gemini-2.5-flash", 1_000_000, 1_000_000) == pytest.approx(2.80)


def test_model_name_matches_by_prefix_longest_first():
    # "gemini-2.5-flash-lite" must price as flash-lite, not the pricier flash.
    assert gemini_cost_usd("gemini-2.5-flash-lite", 1_000_000, 0) == pytest.approx(0.10)
    # A preview / dated suffix still finds its family.
    assert gemini_cost_usd("gemini-3-flash-preview", 1_000_000, 0) == pytest.approx(0.50)


def test_unknown_model_uses_conservative_fallback(caplog):
    cost = gemini_cost_usd("some-future-model", 1_000_000, 1_000_000)
    assert cost == pytest.approx(14.0)
    assert "No price known" in caplog.text


def test_overrides_win():
    assert gemini_cost_usd("anything", 1_000_000, 1_000_000, 1.0, 2.0) == pytest.approx(3.0)


def test_python_and_the_app_read_the_same_price_table():
    from leadengine.pricing import GEMINI_USD_PER_MILLION
    from leadengine.shared import SPEC

    assert GEMINI_USD_PER_MILLION["gemini-2.5-flash"] == (0.3, 2.5)
    assert set(GEMINI_USD_PER_MILLION) == set(SPEC["pricing"]["geminiUsdPerMillion"])
