import pytest

from leadengine.pricing import openai_cost_usd


def test_known_model_cost():
    # 1M in + 1M out on gpt-4o-mini = $0.15 + $0.60
    assert openai_cost_usd("gpt-4o-mini", 1_000_000, 1_000_000) == pytest.approx(0.75)


def test_dated_model_name_matches_by_prefix_longest_first():
    # "gpt-4o-mini-2024-07-18" must price as gpt-4o-mini, not the pricier gpt-4o.
    assert openai_cost_usd("gpt-4o-mini-2024-07-18", 1_000_000, 0) == pytest.approx(0.15)


def test_unknown_model_uses_conservative_fallback(caplog):
    cost = openai_cost_usd("some-future-model", 1_000_000, 1_000_000)
    assert cost == pytest.approx(2.40)
    assert "No price known" in caplog.text


def test_overrides_win():
    assert openai_cost_usd("anything", 1_000_000, 1_000_000, 1.0, 2.0) == pytest.approx(3.0)
