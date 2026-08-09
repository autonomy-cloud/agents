from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from urllib.parse import urlparse

AsyncAzureADTokenProvider = Callable[[], str | Awaitable[str]]


def get_base_url(base_url: str | None) -> str:
    if not base_url:
        base_url = os.getenv("OPENAGENTS_OPENAI_BASE_URL")
    if not base_url:
        raise ValueError(
            "an explicit internal OpenAI-compatible base URL is required "
            "(base_url or OPENAGENTS_OPENAI_BASE_URL)"
        )
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("OpenAI-compatible base URL must be an explicit http(s) URL")
    if parsed.hostname == "api.openai.com":
        raise ValueError("public OpenAI endpoints are disabled in OpenAgents")
    return base_url


__all__ = ["get_base_url", "AsyncAzureADTokenProvider"]
