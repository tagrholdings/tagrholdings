import json
from types import SimpleNamespace

import pytest

from leadengine.extraction.extractor import GeminiExtractor, fields_from_hints_only, to_extracted_fields
from leadengine.extraction.gemini_client import GeminiAnswer
from leadengine.models import Candidate


class FakeGenerate:
    """Stands in for gemini_client.generate_json: records the call, returns a canned answer."""

    def __init__(self, text: str, model="gemini-2.5-flash", prompt=1000, completion=200, truncated=False):
        self.calls = []
        self._answer = GeminiAnswer(text=text, model=model, input_tokens=prompt, output_tokens=completion, truncated=truncated)

    def __call__(self, settings, system, user, schema, max_output_tokens):
        self.calls.append({"system": system, "user": user, "schema": schema, "max_output_tokens": max_output_tokens})
        return self._answer


SETTINGS = SimpleNamespace(gemini_model="gemini-2.5-flash", gemini_api_key="k", gemini_input_usd_per_million=None, gemini_output_usd_per_million=None)


def candidate():
    return Candidate(
        source_type="google_places",
        dedupe_key="abc",
        business_name="Cool Air Phoenix",
        website="https://coolair.test",
        hints={"phone": "(602) 555-0100", "address": "1 Main St, Phoenix, AZ"},
    )


MODEL_OUTPUT = {
    "business_name": "Cool Air Phoenix LLC",
    "industry": "HVAC",
    "summary": "HVAC contractor in Phoenix.",
    "address": None,
    "city": "Phoenix",
    "state": "AZ",
    "website": None,
    "contact_name": "Bob",
    "contact_email": None,
    "contact_phone": None,
    "estimated_revenue": "$2M",
    "asking_price": None,
    "reason_for_selling": "retirement",
    "employees": "14",
    "years_in_business": "22",
    "signals": ["retiring", " "],
}


def test_maps_to_nested_shape_and_fills_gaps_from_hints():
    fields = to_extracted_fields(
        MODEL_OUTPUT, {"phone": "(602) 555-0100", "address": "1 Main St", "website": "https://coolair.test"}
    )
    assert fields["businessName"] == "Cool Air Phoenix LLC"
    assert fields["contact"] == {"name": "Bob", "email": None, "phone": "(602) 555-0100"}
    assert fields["location"] == {"address": "1 Main St", "city": "Phoenix", "state": "AZ"}
    assert fields["website"] == "https://coolair.test"
    assert fields["signals"] == ["retiring"]
    assert fields["reasonForSelling"] == "retirement"


def test_extract_records_priced_usage():
    generate = FakeGenerate(json.dumps(MODEL_OUTPUT))
    result = GeminiExtractor(SETTINGS, generate=generate).extract(candidate(), "some scraped text")
    assert result.usage is not None
    assert result.usage.provider == "gemini" and result.usage.operation == "extract"
    assert result.usage.model == "gemini-2.5-flash"
    assert result.usage.input_tokens == 1000 and result.usage.output_tokens == 200
    # 1000 * 0.30/1M + 200 * 2.50/1M
    assert abs(result.usage.cost_usd - 0.0008) < 1e-9
    call = generate.calls[0]
    from leadengine.extraction.prompt import OUTPUT_SCHEMA, SYSTEM_PROMPT

    assert call["system"] == SYSTEM_PROMPT and call["schema"] == OUTPUT_SCHEMA and call["max_output_tokens"] == 800
    # Untrusted page text is delimited as data.
    assert "BEGIN SCRAPED TEXT" in call["user"]


def test_bad_json_still_bills_and_falls_back_to_hints():
    generate = FakeGenerate("not json at all")
    result = GeminiExtractor(SETTINGS, generate=generate).extract(candidate(), "text")
    assert result.usage is not None  # the call happened, so it is on the bill
    assert result.fields["businessName"] == "Cool Air Phoenix"
    assert result.fields["contact"]["phone"] == "(602) 555-0100"


def test_a_reply_cut_off_by_the_token_limit_is_not_half_parsed():
    generate = FakeGenerate('{"business_name": "Cool', truncated=True)
    result = GeminiExtractor(SETTINGS, generate=generate).extract(candidate(), "text")
    assert result.usage is not None and result.fields["businessName"] == "Cool Air Phoenix"


def test_a_json_array_is_not_an_extraction():
    result = GeminiExtractor(SETTINGS, generate=FakeGenerate("[1, 2]")).extract(candidate(), "text")
    assert result.fields["businessName"] == "Cool Air Phoenix" and result.usage is not None


def test_it_refuses_to_start_without_a_key_unless_a_generator_is_injected():
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        GeminiExtractor(SimpleNamespace(gemini_api_key=None))
    GeminiExtractor(SimpleNamespace(gemini_api_key=None), generate=FakeGenerate("{}"))  # tests inject one: fine


def test_hints_only_fallback():
    fields = fields_from_hints_only(candidate())
    assert fields["businessName"] == "Cool Air Phoenix"
    assert fields["website"] == "https://coolair.test"
    assert fields["location"]["address"] == "1 Main St, Phoenix, AZ"
