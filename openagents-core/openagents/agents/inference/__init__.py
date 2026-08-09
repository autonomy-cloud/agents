from typing import Any, Literal, TypeAlias

from .interruption import (
    AdaptiveInterruptionDetector,
    InterruptionDataFrameType,
    InterruptionDetectionError,
    OverlappingSpeechEvent,
)

# OpenAgents intentionally does not expose hosted inference wrappers. Keep
# these type aliases and marker classes so existing isinstance checks and type
# annotations remain source-compatible while callers migrate to explicit local
# or OpenAI-compatible model objects.
LLMModels: TypeAlias = str
STTModels: TypeAlias = str
TTSModels: TypeAlias = str
VADModels: TypeAlias = Literal["silero"]
TurnDetectorModels: TypeAlias = str
TurnDetectorVersions: TypeAlias = str


class CloudInferenceDisabledError(RuntimeError):
    pass


class _DisabledCloudInference:
    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        raise CloudInferenceDisabledError(
            "Hosted inference is removed from OpenAgents. "
            "Pass an explicit local or OpenAI-compatible model object."
        )


class LLM(_DisabledCloudInference):
    pass


class LLMStream(_DisabledCloudInference):
    pass


class STT(_DisabledCloudInference):
    pass


class TTS(_DisabledCloudInference):
    pass


class VAD(_DisabledCloudInference):
    pass


class TurnDetector(_DisabledCloudInference):
    pass


__all__ = [
    "STT",
    "TTS",
    "LLM",
    "VAD",
    "LLMStream",
    "STTModels",
    "TTSModels",
    "LLMModels",
    "VADModels",
    "AdaptiveInterruptionDetector",
    "InterruptionDetectionError",
    "OverlappingSpeechEvent",
    "InterruptionDataFrameType",
    "TurnDetector",
    "TurnDetectorModels",
    "TurnDetectorVersions",
    "CloudInferenceDisabledError",
]
