from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class ModelEndpointConfig:
    """Configuration for an explicitly selected OpenAI-compatible endpoint.

    There is deliberately no public-cloud default. An endpoint must be provided
    by configuration so an air-gapped deployment cannot silently call OpenAI.
    """

    base_url: str
    llm_model: str
    api_key: str = "airgap-local"
    stt_model: str | None = None
    tts_model: str | None = None
    tts_voice: str = "alloy"

    def __post_init__(self) -> None:
        parsed = urlparse(self.base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("model base_url must be an explicit http(s) URL")
        if parsed.hostname == "api.openai.com":
            raise ValueError("public OpenAI is disabled in the air-gapped runtime")
        if not self.llm_model:
            raise ValueError("llm_model is required")

    @classmethod
    def from_env(cls) -> ModelEndpointConfig:
        base_url = os.environ.get("OPENAGENTS_OPENAI_BASE_URL")
        llm_model = os.environ.get("OPENAGENTS_LLM_MODEL")
        if not base_url or not llm_model:
            raise ValueError(
                "OPENAGENTS_OPENAI_BASE_URL and OPENAGENTS_LLM_MODEL are required"
            )
        return cls(
            base_url=base_url,
            llm_model=llm_model,
            api_key=os.environ.get("OPENAGENTS_OPENAI_API_KEY", "airgap-local"),
            stt_model=os.environ.get("OPENAGENTS_STT_MODEL"),
            tts_model=os.environ.get("OPENAGENTS_TTS_MODEL"),
            tts_voice=os.environ.get("OPENAGENTS_TTS_VOICE", "alloy"),
        )


@dataclass(frozen=True)
class RuntimeConfig:
    host: str = "127.0.0.1"
    port: int = 7880
    rtc_tcp_port: int = 7881
    rtc_port_range_start: int = 50000
    rtc_port_range_end: int = 60000
    server_binary: Path | None = None
    startup_timeout: float = 15.0

    def __post_init__(self) -> None:
        for name, value in (
            ("port", self.port),
            ("rtc_tcp_port", self.rtc_tcp_port),
            ("rtc_port_range_start", self.rtc_port_range_start),
            ("rtc_port_range_end", self.rtc_port_range_end),
        ):
            if not 1 <= value <= 65535:
                raise ValueError(f"{name} must be between 1 and 65535")
        if self.rtc_port_range_start > self.rtc_port_range_end:
            raise ValueError("rtc_port_range_start must not exceed rtc_port_range_end")
        if self.port == self.rtc_tcp_port:
            raise ValueError("port and rtc_tcp_port must be different")
        if self.startup_timeout <= 0:
            raise ValueError("startup_timeout must be positive")
