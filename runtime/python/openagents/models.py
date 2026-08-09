from __future__ import annotations

from dataclasses import dataclass

from openagents.agents import llm, stt, tts, vad
from openagents.plugins import openai, silero

from .config import ModelEndpointConfig


@dataclass(frozen=True)
class ModelStack:
    llm: llm.LLM
    vad: vad.VAD
    stt: stt.STT | None
    tts: tts.TTS | None


def create_model_stack(config: ModelEndpointConfig) -> ModelStack:
    """Create models that can only address the configured internal endpoint."""

    common = {"base_url": config.base_url, "api_key": config.api_key}
    return ModelStack(
        llm=openai.LLM(model=config.llm_model, **common),
        vad=silero.VAD.load(),
        stt=(openai.STT(model=config.stt_model, **common) if config.stt_model else None),
        tts=(
            openai.TTS(
                model=config.tts_model,
                voice=config.tts_voice,
                **common,
            )
            if config.tts_model
            else None
        ),
    )

