from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from opentelemetry import context as otel_context, metrics as metrics_api, trace as trace_api
from opentelemetry._logs import get_logger_provider
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk.metrics import MeterProvider as SdkMeterProvider
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.trace import Span, Tracer
from opentelemetry.util._decorator import _agnosticcontextmanager
from opentelemetry.util.types import Attributes, AttributeValue

from ..log import logger
from . import trace_types

if TYPE_CHECKING:
    from ..llm import ChatContext


class _DynamicTracer(Tracer):
    """Tracer whose provider can be replaced by a local application."""

    def __init__(self, instrumenting_module_name: str) -> None:
        self._instrumenting_module_name = instrumenting_module_name
        self._tracer_provider: trace_api.TracerProvider = trace_api.get_tracer_provider()
        self._tracer = trace_api.get_tracer(instrumenting_module_name)

    def set_provider(self, tracer_provider: trace_api.TracerProvider) -> None:
        self._tracer_provider = tracer_provider
        self._tracer = trace_api.get_tracer(
            self._instrumenting_module_name,
            tracer_provider=tracer_provider,
        )

    def start_span(self, *args: Any, **kwargs: Any) -> Span:
        return self._tracer.start_span(*args, **kwargs)

    @_agnosticcontextmanager
    def start_as_current_span(self, *args: Any, **kwargs: Any) -> Iterator[Span]:
        with self._tracer.start_as_current_span(*args, **kwargs) as span:
            yield span


tracer: _DynamicTracer = _DynamicTracer("openagents")


class _MetadataSpanProcessor(SpanProcessor):
    def __init__(self, metadata: dict[str, AttributeValue]) -> None:
        self._metadata = metadata

    def on_start(self, span: Span, parent_context: otel_context.Context | None = None) -> None:
        span.set_attributes(self._metadata)


class _BufferingHandler(logging.Handler):
    """Compatibility buffer retained for the worker lifecycle."""

    def __init__(self) -> None:
        super().__init__()
        self.buffer: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.buffer.append(record)


def set_tracer_provider(
    tracer_provider: trace_api.TracerProvider,
    *,
    metadata: dict[str, AttributeValue] | None = None,
) -> None:
    """Attach a caller-owned local tracer provider.

    The runtime does not construct an exporter or choose a network endpoint.
    """

    if metadata and isinstance(tracer_provider, trace_sdk.TracerProvider):
        tracer_provider.add_span_processor(_MetadataSpanProcessor(metadata))
    tracer.set_provider(tracer_provider)


def _chat_ctx_to_otel_events(chat_ctx: ChatContext) -> list[tuple[str, Attributes]]:
    role_to_event = {
        "system": trace_types.EVENT_GEN_AI_SYSTEM_MESSAGE,
        "developer": trace_types.EVENT_GEN_AI_SYSTEM_MESSAGE,
        "user": trace_types.EVENT_GEN_AI_USER_MESSAGE,
        "assistant": trace_types.EVENT_GEN_AI_ASSISTANT_MESSAGE,
    }

    events: list[tuple[str, Attributes]] = []
    for item in chat_ctx.items:
        if item.type == "message" and (event_name := role_to_event.get(item.role)):
            events.append((event_name, {"content": item.raw_text_content or ""}))
        elif item.type == "function_call":
            events.append(
                (
                    trace_types.EVENT_GEN_AI_ASSISTANT_MESSAGE,
                    {
                        "role": "assistant",
                        "tool_calls": [
                            json.dumps(
                                {
                                    "function": {"name": item.name, "arguments": item.arguments},
                                    "id": item.call_id,
                                    "type": "function",
                                }
                            )
                        ],
                    },
                )
            )
        elif item.type == "function_call_output":
            events.append(
                (
                    trace_types.EVENT_GEN_AI_TOOL_MESSAGE,
                    {"content": item.output, "name": item.name, "id": item.call_id},
                )
            )
    return events


_TELEMETRY_SHUTDOWN_TIMEOUT = 10.0


def _shutdown_telemetry(timeout: float = _TELEMETRY_SHUTDOWN_TIMEOUT) -> None:
    """Shut down caller-configured local OTel providers within a fixed bound."""

    root = logging.getLogger()
    for handler in list(root.handlers):
        if isinstance(handler, LoggingHandler):
            root.removeHandler(handler)

    providers: list[Any] = []
    if isinstance(provider := get_logger_provider(), LoggerProvider):
        providers.append(provider)
    if isinstance(provider := tracer._tracer_provider, trace_sdk.TracerProvider):
        providers.append(provider)
    if isinstance(provider := metrics_api.get_meter_provider(), SdkMeterProvider):
        providers.append(provider)

    def _shutdown_one(provider: Any) -> None:
        try:
            provider.shutdown()
        except Exception:
            logger.exception("failed to shut down telemetry provider")

    threads = [
        threading.Thread(
            target=_shutdown_one,
            args=(provider,),
            name=f"openagents-telemetry-shutdown-{type(provider).__name__}",
            daemon=True,
        )
        for provider in providers
    ]
    for thread in threads:
        thread.start()

    deadline = time.monotonic() + timeout
    for thread in threads:
        thread.join(max(0.0, deadline - time.monotonic()))

    if any(thread.is_alive() for thread in threads):
        logger.warning("telemetry shutdown exceeded %.1fs; continuing", timeout)
