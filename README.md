# OpenAgents Runtime

OpenAgents is an air-gapped realtime agent runtime. It combines an
adapted Python agent framework, a source-built WebRTC transport, local
Silero VAD endpointing, and explicitly configured OpenAI-compatible model
endpoints.

The deployment contract is strict:

- no external realtime cloud account or user-managed transport credentials;
- no public model-provider defaults;
- no downloads from package registries, GitHub, or model hubs at runtime;
- internal transport credentials are generated and owned by the runtime;
- all native transport sources and pinned revisions are present in this repo.

## Retained components

- `openagents-core/`: adapted agent framework core
- `openagents-plugins/openai/`: OpenAI-compatible protocol adapter
- `openagents-plugins/silero/`: local VAD
- `runtime/components/openagents-server/`: WebRTC server source
- `runtime/components/openagents-python-sdks/`: Python RTC, protocol, and Rust FFI source
- `runtime/python/`: OpenAgents runtime, credential ownership, and process supervision

Pinned upstream revisions and retained license obligations are recorded in
[`runtime/COMPONENTS.md`](runtime/COMPONENTS.md).

## Internal model endpoint

An explicit internal endpoint is mandatory. There is intentionally no
`https://api.openai.com` fallback.

```bash
export OPENAGENTS_OPENAI_BASE_URL=http://model-gateway.internal:8000/v1
export OPENAGENTS_OPENAI_API_KEY=internal-token
export OPENAGENTS_LLM_MODEL=internal-chat-model
export OPENAGENTS_STT_MODEL=internal-transcription-model
export OPENAGENTS_TTS_MODEL=internal-speech-model
```

`OPENAGENTS_STT_MODEL` and `OPENAGENTS_TTS_MODEL` are optional when the deployment
uses text-only sessions or separate audio adapters.

## Development

The repository uses Python 3.12 and `uv`.

```bash
uv sync
uv run pytest --unit
uv run ruff check runtime/python openagents-core \
  openagents-plugins/openai \
  openagents-plugins/silero
```

## Offline macOS ARM64 bundle

The checked-in wheel directory contains the framework, RTC FFI, Silero model,
third-party Python wheels, and a runtime wheel with the OpenAgents server
binary embedded.

```bash
python3.12 -m venv .runtime
.runtime/bin/pip install --no-index \
  --find-links runtime/vendor/python/wheels \
  openagents-runtime==0.1.0
.runtime/bin/openagents serve
```

The same packaging job must be run on/for Linux AMD64 before deploying there;
native RTC, ONNX Runtime, PyAV, and server artifacts cannot be reused across
operating systems. The Go and Rust dependency graphs are already vendored for
offline source builds.
