from __future__ import annotations

import datetime

import jwt
import pytest

from openagents import ModelEndpointConfig, Runtime, RuntimeConfig
from openagents.agents import llm as agents_llm
from openagents.plugins import openai

pytestmark = pytest.mark.unit


def test_model_endpoint_must_be_explicit() -> None:
    with pytest.raises(ValueError, match="explicit http"):
        ModelEndpointConfig(base_url="", llm_model="internal")


def test_public_openai_endpoint_is_disabled() -> None:
    with pytest.raises(ValueError, match="public OpenAI is disabled"):
        ModelEndpointConfig(base_url="https://api.openai.com/v1", llm_model="gpt")


def test_runtime_owns_participant_credentials() -> None:
    runtime = Runtime()
    token = runtime.participant_token(
        room="private-room",
        identity="internal-user",
        ttl=datetime.timedelta(minutes=1),
    )
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["sub"] == "internal-user"
    assert claims["video"]["room"] == "private-room"
    assert claims["video"]["roomJoin"] is True


def test_runtime_ports_are_validated() -> None:
    with pytest.raises(ValueError, match="rtc_tcp_port"):
        RuntimeConfig(rtc_tcp_port=0)
    with pytest.raises(ValueError, match="must not exceed"):
        RuntimeConfig(rtc_port_range_start=52000, rtc_port_range_end=51000)
    with pytest.raises(ValueError, match="must be different"):
        RuntimeConfig(port=7880, rtc_tcp_port=7880)


def test_openai_adapter_requires_internal_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAGENTS_OPENAI_BASE_URL", raising=False)
    with pytest.raises(ValueError, match="explicit internal"):
        openai.LLM(model="internal-model", api_key="local")

    with pytest.raises(ValueError, match="public OpenAI endpoints are disabled"):
        openai.LLM(
            model="internal-model",
            api_key="local",
            base_url="https://api.openai.com/v1",
        )


def test_openai_adapter_accepts_internal_endpoint() -> None:
    model = openai.LLM(
        model="internal-model",
        api_key="local",
        base_url="http://models.internal/v1",
    )
    assert model._client.base_url.host == "models.internal"
    assert model.chat.__self__ is model


@pytest.mark.asyncio
async def test_openai_adapter_constructs_a_stream() -> None:
    model = openai.LLM(
        model="internal-model",
        api_key="local",
        base_url="http://models.internal/v1",
    )
    stream = model.chat(chat_ctx=agents_llm.ChatContext.empty())
    assert stream._tool_ctx is not None
    await stream.aclose()
    await model.aclose()
