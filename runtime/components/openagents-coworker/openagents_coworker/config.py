"""Environment-driven configuration for the Anika coworker worker.

Every setting has a name consistent with the rest of this project's
``OPENAGENTS_*`` convention. The connection settings default to the same
``ws://127.0.0.1:7880`` / ``devkey`` / ``secret`` dev convention used
elsewhere in this repo; the model endpoint has deliberately no public-cloud
default (see ``AGENTS.md``: "Model traffic must use
``OPENAGENTS_OPENAI_BASE_URL``. Public OpenAI is explicitly rejected.").
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from openagents.plugins.openai.utils import get_base_url

DEFAULT_URL = "ws://127.0.0.1:7880"
DEFAULT_API_KEY = "devkey"
DEFAULT_API_SECRET = "secret"

DEFAULT_IDENTITY = "anika-coworker"
DEFAULT_DISPLAY_NAME = "Anika"
DEFAULT_AGENT_NAME = ""  # "" -> automatic dispatch into any room, not a named/explicit dispatch

DEFAULT_LLM_MODEL = "gpt-4.1"
DEFAULT_STT_MODEL = "gpt-4o-mini-transcribe"
DEFAULT_TTS_MODEL = "gpt-4o-mini-tts"
DEFAULT_TTS_VOICE = "ash"


@dataclass(frozen=True)
class WorkerConnectionConfig:
    """Where and how the worker connects to ``openagents-server``."""

    url: str
    api_key: str
    api_secret: str
    identity: str
    display_name: str
    agent_name: str

    @classmethod
    def from_env(cls) -> WorkerConnectionConfig:
        return cls(
            url=os.environ.get("OPENAGENTS_URL", DEFAULT_URL),
            api_key=os.environ.get("OPENAGENTS_API_KEY", DEFAULT_API_KEY),
            api_secret=os.environ.get("OPENAGENTS_API_SECRET", DEFAULT_API_SECRET),
            identity=os.environ.get("OPENAGENTS_COWORKER_IDENTITY", DEFAULT_IDENTITY),
            display_name=os.environ.get("OPENAGENTS_COWORKER_NAME", DEFAULT_DISPLAY_NAME),
            agent_name=os.environ.get("OPENAGENTS_AGENT_NAME", DEFAULT_AGENT_NAME),
        )


@dataclass(frozen=True)
class ModelConfig:
    """Which models to request from the internal OpenAI-compatible endpoint."""

    base_url: str
    api_key: str
    llm_model: str
    stt_model: str
    tts_model: str
    tts_voice: str

    @classmethod
    def from_env(cls) -> ModelConfig:
        # Raises ValueError with a clear message when OPENAGENTS_OPENAI_BASE_URL is
        # unset, empty, malformed, or points at public OpenAI. Reusing the plugin's
        # own validator (rather than re-implementing it) keeps this check identical
        # to what openai.STT/LLM/TTS will themselves enforce later.
        base_url = get_base_url(None)
        return cls(
            base_url=base_url,
            api_key=os.environ.get("OPENAGENTS_OPENAI_API_KEY", "airgap-local"),
            llm_model=os.environ.get("OPENAGENTS_LLM_MODEL", DEFAULT_LLM_MODEL),
            stt_model=os.environ.get("OPENAGENTS_STT_MODEL", DEFAULT_STT_MODEL),
            tts_model=os.environ.get("OPENAGENTS_TTS_MODEL", DEFAULT_TTS_MODEL),
            tts_voice=os.environ.get("OPENAGENTS_TTS_VOICE", DEFAULT_TTS_VOICE),
        )


def validate_model_config_early() -> None:
    """Fail fast, at process startup, if the model endpoint is not configured.

    Without this, the misconfiguration would otherwise only surface once a job
    is dispatched and the pipeline tries to construct its STT/LLM/TTS clients
    inside the job subprocess, which is a confusing place to first learn that
    ``OPENAGENTS_OPENAI_BASE_URL`` was never set.
    """

    get_base_url(None)
