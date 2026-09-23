"""Anika: the OpenAgents digital coworker voice worker.

This package wires a real ``openagents-core`` voice pipeline (Silero VAD,
OpenAI-compatible-endpoint STT/LLM/TTS) into a job-dispatched worker that
registers with a running ``openagents-server`` and joins rooms as the
participant identity ``anika-coworker``.
"""

from .version import __version__

__all__ = ["__version__"]
