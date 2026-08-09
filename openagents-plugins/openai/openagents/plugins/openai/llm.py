# Copyright 2023 LiveKit, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Literal, cast

import httpx

import openai
from openagents.agents import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    llm,
)
from openagents.agents.llm import (
    ChatContext,
    ToolChoice,
    utils as llm_utils,
)
from openagents.agents.types import (
    DEFAULT_API_CONNECT_OPTIONS,
    NOT_GIVEN,
    APIConnectOptions,
    NotGivenOr,
)
from openagents.agents.utils import is_given
from openai.types import ReasoningEffort
from openai.types.chat import (
    ChatCompletionToolChoiceOptionParam,
    ChatCompletionToolParam,
    completion_create_params,
)
from openai.types.chat.chat_completion_chunk import Choice

from .models import (
    ChatModels,
    _supports_reasoning_effort,
)
from .utils import get_base_url

lk_oai_debug = int(os.getenv("LK_OPENAI_DEBUG", 0))

Verbosity = Literal["low", "medium", "high"]
PromptCacheRetention = Literal["in_memory", "24h"]


@dataclass
class _LLMOptions:
    model: str | ChatModels
    user: NotGivenOr[str]
    safety_identifier: NotGivenOr[str]
    prompt_cache_key: NotGivenOr[str]
    temperature: NotGivenOr[float]
    top_p: NotGivenOr[float]
    parallel_tool_calls: NotGivenOr[bool]
    tool_choice: NotGivenOr[ToolChoice]
    store: NotGivenOr[bool]
    metadata: NotGivenOr[dict[str, str]]
    max_completion_tokens: NotGivenOr[int]
    service_tier: NotGivenOr[str]
    reasoning_effort: NotGivenOr[ReasoningEffort]
    verbosity: NotGivenOr[Verbosity]
    prompt_cache_retention: NotGivenOr[PromptCacheRetention]
    extra_body: NotGivenOr[dict[str, Any]]
    extra_headers: NotGivenOr[dict[str, str]]
    extra_query: NotGivenOr[dict[str, str]]


class LLM(llm.LLM):
    def __init__(
        self,
        *,
        model: str | ChatModels = "gpt-4.1",
        api_key: NotGivenOr[str] = NOT_GIVEN,
        base_url: NotGivenOr[str] = NOT_GIVEN,
        client: openai.AsyncClient | None = None,
        user: NotGivenOr[str] = NOT_GIVEN,
        safety_identifier: NotGivenOr[str] = NOT_GIVEN,
        prompt_cache_key: NotGivenOr[str] = NOT_GIVEN,
        temperature: NotGivenOr[float] = NOT_GIVEN,
        top_p: NotGivenOr[float] = NOT_GIVEN,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[ToolChoice] = NOT_GIVEN,
        store: NotGivenOr[bool] = NOT_GIVEN,
        metadata: NotGivenOr[dict[str, str]] = NOT_GIVEN,
        max_completion_tokens: NotGivenOr[int] = NOT_GIVEN,
        timeout: httpx.Timeout | None = None,
        max_retries: NotGivenOr[int] = NOT_GIVEN,
        service_tier: NotGivenOr[str] = NOT_GIVEN,
        reasoning_effort: NotGivenOr[ReasoningEffort] = NOT_GIVEN,
        verbosity: NotGivenOr[Verbosity] = NOT_GIVEN,
        prompt_cache_retention: NotGivenOr[PromptCacheRetention] = NOT_GIVEN,
        extra_body: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
        extra_headers: NotGivenOr[dict[str, str]] = NOT_GIVEN,
        extra_query: NotGivenOr[dict[str, str]] = NOT_GIVEN,
        _provider_fmt: NotGivenOr[str] = NOT_GIVEN,
        _strict_tool_schema: bool = True,
    ) -> None:
        """
        Create a new instance of OpenAI LLM.

        ``api_key`` must be set to your OpenAI API key, either using the argument or by setting the
        ``OPENAI_API_KEY`` environmental variable.
        """
        super().__init__()

        if not is_given(reasoning_effort) and _supports_reasoning_effort(model):
            if model in ["gpt-5.1", "gpt-5.2", "gpt-5.4", "gpt-5.4-mini"]:
                reasoning_effort = "none"
            else:
                reasoning_effort = "minimal"

        self._opts = _LLMOptions(
            model=model,
            user=user,
            temperature=temperature,
            parallel_tool_calls=parallel_tool_calls,
            tool_choice=tool_choice,
            store=store,
            metadata=metadata,
            max_completion_tokens=max_completion_tokens,
            service_tier=service_tier,
            reasoning_effort=reasoning_effort,
            safety_identifier=safety_identifier,
            prompt_cache_key=prompt_cache_key,
            top_p=top_p,
            verbosity=verbosity,
            prompt_cache_retention=prompt_cache_retention,
            extra_body=extra_body,
            extra_headers=extra_headers,
            extra_query=extra_query,
        )
        if is_given(api_key) and not api_key:
            raise ValueError(
                "OpenAI API key is required, either as argument or set"
                " OPENAI_API_KEY environment variable"
            )

        self._provider_fmt = _provider_fmt or "openai"
        self._strict_tool_schema = _strict_tool_schema
        self._owns_client = client is None
        self._client = client or openai.AsyncClient(
            api_key=api_key if is_given(api_key) else None,
            base_url=get_base_url(base_url if is_given(base_url) else None),
            max_retries=max_retries if is_given(max_retries) else 0,
            http_client=httpx.AsyncClient(
                timeout=timeout
                if timeout
                else httpx.Timeout(connect=15.0, read=5.0, write=5.0, pool=5.0),
                follow_redirects=True,
                limits=httpx.Limits(
                    max_connections=50,
                    max_keepalive_connections=50,
                    keepalive_expiry=120,
                ),
            ),
        )

    async def _prewarm_impl(self) -> None:
        # token-free request supported by openai and openai-compatible servers
        await self._client.models.list()

    async def aclose(self) -> None:
        await super().aclose()

        if self._owns_client:
            await self._client.close()

    @property
    def model(self) -> str:
        return self._opts.model

    @property
    def provider(self) -> str:
        return self._client._base_url.netloc.decode("utf-8")

    def chat(
        self,
        *,
        chat_ctx: ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[ToolChoice] = NOT_GIVEN,
        response_format: NotGivenOr[
            completion_create_params.ResponseFormat | type[llm_utils.ResponseFormatT]
        ] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> LLMStream:
        extra = {}
        if is_given(extra_kwargs):
            extra.update(extra_kwargs)

        if is_given(self._opts.extra_body):
            extra["extra_body"] = self._opts.extra_body

        if is_given(self._opts.extra_headers):
            extra["extra_headers"] = self._opts.extra_headers

        if is_given(self._opts.extra_query):
            extra["extra_query"] = self._opts.extra_query

        if is_given(self._opts.metadata):
            extra["metadata"] = self._opts.metadata

        if is_given(self._opts.user):
            extra["user"] = self._opts.user

        if is_given(self._opts.max_completion_tokens):
            extra["max_completion_tokens"] = self._opts.max_completion_tokens

        if is_given(self._opts.temperature):
            extra["temperature"] = self._opts.temperature

        if is_given(self._opts.service_tier):
            extra["service_tier"] = self._opts.service_tier

        if is_given(self._opts.reasoning_effort):
            extra["reasoning_effort"] = self._opts.reasoning_effort

        if is_given(self._opts.safety_identifier):
            extra["safety_identifier"] = self._opts.safety_identifier

        if is_given(self._opts.prompt_cache_key):
            extra["prompt_cache_key"] = self._opts.prompt_cache_key

        if is_given(self._opts.top_p):
            extra["top_p"] = self._opts.top_p

        if is_given(self._opts.verbosity):
            extra["verbosity"] = self._opts.verbosity

        if is_given(self._opts.prompt_cache_retention):
            extra["prompt_cache_retention"] = self._opts.prompt_cache_retention

        parallel_tool_calls = (
            parallel_tool_calls if is_given(parallel_tool_calls) else self._opts.parallel_tool_calls
        )
        if is_given(parallel_tool_calls):
            extra["parallel_tool_calls"] = parallel_tool_calls

        tool_choice = tool_choice if is_given(tool_choice) else self._opts.tool_choice
        if is_given(tool_choice):
            oai_tool_choice: ChatCompletionToolChoiceOptionParam
            if isinstance(tool_choice, dict):
                oai_tool_choice = {
                    "type": "function",
                    "function": {"name": tool_choice["function"]["name"]},
                }
                extra["tool_choice"] = oai_tool_choice
            elif tool_choice in ("auto", "required", "none"):
                oai_tool_choice = tool_choice
                extra["tool_choice"] = oai_tool_choice

        if is_given(response_format):
            extra["response_format"] = llm_utils.to_openai_response_format(response_format)  # type: ignore

        return LLMStream(
            self,
            model=self._opts.model,
            provider_fmt=self._provider_fmt,
            strict_tool_schema=self._strict_tool_schema,
            client=self._client,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
            extra_kwargs=extra,
        )


class LLMStream(llm.LLMStream):
    def __init__(
        self,
        owner: LLM,
        *,
        model: str | ChatModels,
        provider_fmt: str,
        strict_tool_schema: bool,
        client: openai.AsyncClient,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        conn_options: APIConnectOptions,
        extra_kwargs: dict[str, Any],
    ) -> None:
        super().__init__(
            owner,
            chat_ctx=chat_ctx,
            tools=tools,
            conn_options=conn_options,
        )
        self._model = model
        self._provider_fmt = provider_fmt
        self._strict_tool_schema = strict_tool_schema
        self._client = client
        self._extra_kwargs = extra_kwargs
        self._tool_ctx = llm.ToolContext(tools)

    async def _run(self) -> None:
        self._tool_call_id: str | None = None
        self._fnc_name: str | None = None
        self._fnc_raw_arguments: str | None = None
        self._tool_extra: dict[str, Any] | None = None
        self._tool_index: int | None = None
        retryable = True

        try:
            chat_ctx, _ = self._chat_ctx.to_provider_format(format=self._provider_fmt)
            tool_schemas = cast(
                list[ChatCompletionToolParam],
                self._tool_ctx.parse_function_tools("openai", strict=self._strict_tool_schema),
            )
            if not self._tools:
                self._extra_kwargs.pop("tool_choice", None)

            stream = await self._client.chat.completions.create(
                messages=cast(Any, chat_ctx),
                tools=tool_schemas or openai.omit,
                model=self._model,
                stream_options={"include_usage": True},
                stream=True,
                timeout=httpx.Timeout(self._conn_options.timeout),
                **self._extra_kwargs,
            )
            thinking_filter = llm_utils.ThinkingTokenFilter(
                llm_utils.THINK_TAG_START, llm_utils.THINK_TAG_END
            )
            async with stream:
                async for chunk in stream:
                    for choice in chunk.choices:
                        parsed = self._parse_choice(chunk.id, choice, thinking_filter)
                        if parsed is not None:
                            retryable = False
                            self._event_ch.send_nowait(parsed)

                    if chunk.usage is not None:
                        retryable = False
                        details = chunk.usage.prompt_tokens_details
                        self._event_ch.send_nowait(
                            llm.ChatChunk(
                                id=chunk.id,
                                usage=llm.CompletionUsage(
                                    completion_tokens=chunk.usage.completion_tokens,
                                    prompt_tokens=chunk.usage.prompt_tokens,
                                    prompt_cached_tokens=(details.cached_tokens if details else 0)
                                    or 0,
                                    total_tokens=chunk.usage.total_tokens,
                                    service_tier=getattr(chunk, "service_tier", None),
                                ),
                            )
                        )
        except openai.APITimeoutError:
            raise APITimeoutError(retryable=retryable) from None
        except openai.APIStatusError as exc:
            raise APIStatusError(
                exc.message,
                status_code=exc.status_code,
                request_id=exc.request_id,
                body=exc.body,
                retryable=retryable,
            ) from None
        except Exception as exc:
            raise APIConnectionError(retryable=retryable) from exc

    def _parse_choice(
        self,
        chunk_id: str,
        choice: Choice,
        thinking_filter: llm_utils.ThinkingTokenFilter,
    ) -> llm.ChatChunk | None:
        delta = choice.delta
        if delta is None:
            return None

        delta.content = llm_utils.strip_thinking_tokens(
            delta.content, thinking_filter, final=choice.finish_reason is not None
        )
        if delta.tool_calls:
            for tool in delta.tool_calls:
                if not tool.function:
                    continue
                completed = None
                if self._tool_call_id and tool.id and tool.index != self._tool_index:
                    completed = self._tool_chunk(chunk_id, delta.content)
                    self._reset_tool_call()
                if tool.function.name:
                    self._tool_index = tool.index
                    self._tool_call_id = tool.id
                    self._fnc_name = tool.function.name
                    self._fnc_raw_arguments = tool.function.arguments or ""
                    self._tool_extra = getattr(tool, "extra_content", None)
                elif tool.function.arguments:
                    self._fnc_raw_arguments = (self._fnc_raw_arguments or "") + tool.function.arguments
                if completed is not None:
                    return completed

        if choice.finish_reason in ("tool_calls", "stop") and self._tool_call_id:
            completed = self._tool_chunk(chunk_id, delta.content)
            self._reset_tool_call()
            return completed

        extra = getattr(delta, "extra_content", None)
        if not delta.content and not extra:
            return None
        return llm.ChatChunk(
            id=chunk_id,
            delta=llm.ChoiceDelta(content=delta.content, role="assistant", extra=extra),
        )

    def _tool_chunk(self, chunk_id: str, content: str | None) -> llm.ChatChunk:
        return llm.ChatChunk(
            id=chunk_id,
            delta=llm.ChoiceDelta(
                role="assistant",
                content=content,
                tool_calls=[
                    llm.FunctionToolCall(
                        arguments=self._fnc_raw_arguments or "",
                        name=self._fnc_name or "",
                        call_id=self._tool_call_id or "",
                        extra=self._tool_extra,
                    )
                ],
            ),
        )

    def _reset_tool_call(self) -> None:
        self._tool_call_id = None
        self._fnc_name = None
        self._fnc_raw_arguments = None
        self._tool_extra = None
