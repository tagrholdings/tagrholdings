import json
from types import SimpleNamespace

import httpx
import pytest

from leadengine.extraction.gemini_client import GeminiAnswer, GeminiError, generate_json, parse_json_object

SCHEMA = {"type": "object", "properties": {"a": {"type": ["string", "null"]}}, "required": ["a"], "additionalProperties": False}


def settings(model="gemini-2.5-flash", key="secret-key-123"):
    return SimpleNamespace(gemini_api_key=key, gemini_model=model)


def reply(text='{"a": "x"}', *, prompt=1000, candidates=200, thoughts=None, finish="STOP", model="gemini-2.5-flash"):
    usage = {"promptTokenCount": prompt, "candidatesTokenCount": candidates}
    if thoughts:
        usage["thoughtsTokenCount"] = thoughts
    return {"modelVersion": model, "usageMetadata": usage, "candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish}]}


def client_for(*responses):
    """An httpx client whose server answers with the given (status, json) pairs in order; records the requests."""
    seen = []
    queue = list(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        status, body = queue.pop(0)
        return httpx.Response(status, json=body)

    return httpx.Client(transport=httpx.MockTransport(handler)), seen


def call(client, cfg=None, sleeps=None):
    return generate_json(cfg or settings(), "SYS", "USER", SCHEMA, 800, http=client, sleep=(sleeps.append if sleeps is not None else (lambda s: None)))


def test_sends_the_prompt_schema_and_key_and_returns_the_priced_numbers():
    client, seen = client_for((200, reply(thoughts=None)))
    answer = call(client)
    request = seen[0]
    assert str(request.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    assert request.headers["x-goog-api-key"] == "secret-key-123"
    body = json.loads(request.content)
    assert body["systemInstruction"]["parts"][0]["text"] == "SYS"
    assert body["contents"][0]["parts"][0]["text"] == "USER"
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json" and config["responseJsonSchema"] == SCHEMA
    assert config["maxOutputTokens"] == 800 and config["temperature"] == 0
    assert config["thinkingConfig"] == {"thinkingBudget": 0}
    assert answer == GeminiAnswer(text='{"a": "x"}', model="gemini-2.5-flash", input_tokens=1000, output_tokens=200, truncated=False)


def test_thinking_tokens_count_as_output_and_a_model_that_cannot_turn_thinking_off_isnt_asked_to():
    client, seen = client_for((200, reply(thoughts=500, model="gemini-3.1-pro-preview")))
    answer = call(client, settings(model="gemini-3.1-pro-preview"))
    assert "thinkingConfig" not in json.loads(seen[0].content)["generationConfig"]
    assert answer.output_tokens == 700 and answer.model == "gemini-3.1-pro-preview"


def test_a_reply_that_hit_the_token_limit_is_marked_truncated():
    client, _ = client_for((200, reply('{"a": "cut', finish="MAX_TOKENS")))
    assert call(client).truncated is True


def test_retries_a_busy_model_with_a_growing_pause_then_succeeds():
    client, seen = client_for((503, {"error": {}}), (429, {"error": {}}), (200, reply()))
    sleeps: list[float] = []
    assert call(client, sleeps=sleeps).text == '{"a": "x"}'
    assert len(seen) == 3 and sleeps == [2.0, 4.0]


def test_gives_up_after_the_last_attempt_and_says_only_the_status():
    client, seen = client_for(*[(503, {"error": {}})] * 4)
    with pytest.raises(GeminiError, match="503") as caught:
        call(client)
    assert len(seen) == 4
    assert "secret-key-123" not in str(caught.value)


def test_a_bad_request_is_not_retried():
    client, seen = client_for((400, {"error": {"message": "bad schema"}}), (200, reply()))
    with pytest.raises(GeminiError, match="400"):
        call(client)
    assert len(seen) == 1


def test_a_network_failure_is_retried_and_then_reported_without_the_key():
    attempts = []

    def handler(request):
        attempts.append(1)
        raise httpx.ConnectError("connection refused", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(GeminiError, match="ConnectError") as caught:
        call(client)
    assert len(attempts) == 4 and "secret-key-123" not in str(caught.value)


def test_no_key_means_no_request():
    client, seen = client_for()
    with pytest.raises(GeminiError, match="GEMINI_API_KEY"):
        call(client, settings(key=None))
    assert seen == []


def test_a_reply_with_no_content_is_an_empty_answer_not_a_crash():
    client, _ = client_for((200, {"modelVersion": "gemini-2.5-flash", "usageMetadata": {"promptTokenCount": 5}, "candidates": [{"finishReason": "SAFETY"}]}))
    answer = call(client)
    assert answer.text == "" and answer.input_tokens == 5 and answer.output_tokens == 0


def test_parse_json_object_accepts_only_a_complete_object():
    ok = lambda text, truncated=False: parse_json_object(GeminiAnswer(text, "m", 0, 0, truncated))  # noqa: E731
    assert ok('{"a": 1}') == {"a": 1}
    assert ok("") == {}  # the model said nothing: an empty object, which maps to no fields
    assert ok("not json") is None
    assert ok("[1]") is None
    assert ok('{"a": 1}', truncated=True) is None
