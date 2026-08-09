from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from openagents.plugins.openai import stt

pytestmark = pytest.mark.unit


class _FakeWebSocket:
    async def send_json(self, _data: object) -> None:
        pass


class _FakeSession:
    def __init__(self) -> None:
        self.url = ""

    async def ws_connect(self, url: str, **_kwargs: object) -> _FakeWebSocket:
        self.url = url
        return _FakeWebSocket()


async def test_realtime_stt_connect_url_includes_model() -> None:
    model = "gateway-transcribe"
    instance = stt.STT(
        api_key="test-key",
        base_url="https://gateway.example.com/v1",
        model=model,
    )
    session = _FakeSession()
    instance._session = session

    await instance._connect_ws(5)

    parsed_url = urlparse(session.url)
    assert parsed_url.scheme == "wss"
    assert parsed_url.netloc == "gateway.example.com"
    assert parsed_url.path == "/v1/realtime"
    assert parse_qs(parsed_url.query) == {"intent": ["transcription"], "model": [model]}
