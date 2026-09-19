import json
from types import SimpleNamespace

from leadengine.extraction.extractor import OpenAIExtractor, fields_from_hints_only, to_extracted_fields
from leadengine.models import Candidate


class FakeClient:
    def __init__(self, content: str, model="gpt-4o-mini-2024-07-18", prompt=1000, completion=200):
        self.calls = []
        self._response = SimpleNamespace(
            model=model,
            usage=SimpleNamespace(prompt_tokens=prompt, completion_tokens=completion),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


SETTINGS = SimpleNamespace(openai_model="gpt-4o-mini", openai_input_usd_per_million=None, openai_output_usd_per_million=None)


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
    client = FakeClient(json.dumps(MODEL_OUTPUT))
    result = OpenAIExtractor(SETTINGS, client=client).extract(candidate(), "some scraped text")
    assert result.usage is not None
    assert result.usage.provider == "openai" and result.usage.operation == "extract"
    assert result.usage.input_tokens == 1000 and result.usage.output_tokens == 200
    # 1000 * 0.15/1M + 200 * 0.60/1M
    assert abs(result.usage.cost_usd - 0.00027) < 1e-9
    call = client.calls[0]
    assert call["response_format"]["json_schema"]["strict"] is True
    # Untrusted page text is delimited as data.
    assert "BEGIN SCRAPED TEXT" in call["messages"][1]["content"]


def test_bad_json_still_bills_and_falls_back_to_hints():
    client = FakeClient("not json at all")
    result = OpenAIExtractor(SETTINGS, client=client).extract(candidate(), "text")
    assert result.usage is not None  # the call happened, so it is on the bill
    assert result.fields["businessName"] == "Cool Air Phoenix"
    assert result.fields["contact"]["phone"] == "(602) 555-0100"


def test_hints_only_fallback():
    fields = fields_from_hints_only(candidate())
    assert fields["businessName"] == "Cool Air Phoenix"
    assert fields["website"] == "https://coolair.test"
    assert fields["location"]["address"] == "1 Main St, Phoenix, AZ"
