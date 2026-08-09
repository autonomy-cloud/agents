from __future__ import annotations

import time
from typing import Any, Literal, TypeAlias

import numpy as np
import numpy.typing as npt
from opentelemetry import trace
from pydantic import BaseModel, ConfigDict, Field, SerializerFunctionWrapHandler, model_serializer

from openagents import rtc


class InterruptionDetectionError(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    type: Literal["interruption_detection_error"] = "interruption_detection_error"
    timestamp: float = Field(default_factory=time.time)
    label: str
    error: Exception = Field(..., exclude=True)
    recoverable: bool


class OverlappingSpeechEvent(BaseModel):
    """Compatibility event retained for reports created by older callers."""

    model_config = ConfigDict(arbitrary_types_allowed=True)
    type: Literal["overlapping_speech"] = "overlapping_speech"
    created_at: float = Field(default_factory=time.time)
    detected_at: float = Field(default_factory=time.time)
    is_interruption: bool = False
    agent_ended: bool = False
    total_duration: float = 0.0
    prediction_duration: float = 0.0
    detection_delay: float = 0.0
    overlap_started_at: float | None = None
    speech_input: npt.NDArray[np.int16] | None = None
    probabilities: npt.NDArray[np.float32] | None = None
    probability: float = 0.0
    num_requests: int = 0

    @model_serializer(mode="wrap")
    def serialize_model(self, handler: SerializerFunctionWrapHandler) -> Any:
        copy = self.model_copy(deep=True)
        arrays = copy.speech_input, copy.probabilities
        copy.speech_input, copy.probabilities = None, None
        try:
            return handler(copy)
        finally:
            copy.speech_input, copy.probabilities = arrays


class AdaptiveInterruptionDetector:
    """Removed hosted detector marker kept for source-compatible type checks."""

    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError(
            "adaptive hosted interruption detection is removed; use local VAD interruption"
        )


class _AgentSpeechStartedSentinel:
    pass


class _AgentSpeechEndedSentinel:
    pass


class _OverlapSpeechStartedSentinel:
    def __init__(
        self,
        speech_duration: float,
        started_at: float,
        user_speaking_span: trace.Span | None = None,
    ) -> None:
        self._speech_duration = speech_duration
        self._user_speaking_span = user_speaking_span
        self._started_at = started_at


class _OverlapSpeechEndedSentinel:
    def __init__(self, ended_at: float, agent_ended: bool = False) -> None:
        self._ended_at = ended_at
        self._agent_ended = agent_ended


class _FlushSentinel:
    pass


InterruptionDataFrameType: TypeAlias = (
    rtc.AudioFrame
    | _AgentSpeechStartedSentinel
    | _AgentSpeechEndedSentinel
    | _OverlapSpeechStartedSentinel
    | _OverlapSpeechEndedSentinel
    | _FlushSentinel
)
