# openagents-coworker

A real, job-dispatched voice AI worker built on `openagents-core`: the
**Anika** digital coworker. It is a genuine worker process — it connects to
a running `openagents-server`, registers itself, and is dispatched into
rooms by the server as participants join, rather than a script that joins
one hardcoded room.

## Pipeline

VAD (Silero) -> STT -> LLM -> TTS, all wired through `openagents-core`'s
`AgentSession`:

- **VAD**: `openagents.plugins.silero.VAD.load()`, prewarmed once per worker
  process (see `openagents_coworker/worker.py:prewarm`) and reused across
  jobs via `JobProcess.userdata`.
- **STT / LLM / TTS**: `openagents.plugins.openai.{STT,LLM,TTS}`, all
  pointed at `OPENAGENTS_OPENAI_BASE_URL`.
- **Turn detection**: left at `AgentSession`'s own default, which is
  VAD-based turn detection (`turn_handling` defaults to
  `{"turn_detection": "vad"}` whenever a VAD is configured — see
  `openagents-core/openagents/agents/voice/agent_session.py`).

  A dedicated semantic turn-detector model exists in this project's plan
  (`openagents-plugins/livekit-plugins-turn-detector`), but **that plugin
  directory in this repo currently contains no implementation** — it holds
  only a `.gitignore` file and no Python package, `pyproject.toml`, or
  model code. It has not actually been absorbed yet, so this component
  cannot depend on it or import a real `TurnDetector` class from it. Once
  that plugin is implemented, wiring it in is a small change: construct its
  detector and pass it as `AgentSession(..., turn_detection=<detector
  instance>)` (or via `turn_handling=TurnHandlingOptions(turn_detection=...)`),
  per the `TurnDetectionMode` protocol in
  `openagents-core/openagents/agents/voice/turn.py`.

## Identity

The agent joins as participant identity `anika-coworker` (display name
`Anika`), matching this project's coworker identity convention. This is set
per-job in the worker's `on_request` handler (`openagents_coworker/worker.py`)
via `JobRequest.accept(identity=..., name=...)` — identity is not something
the LiveKit-style framework lets a job entrypoint set directly; it must be
supplied when the job request is accepted, before the room connection is
made. Override with `OPENAGENTS_COWORKER_IDENTITY` / `OPENAGENTS_COWORKER_NAME`.

## Configuration

All configuration is environment-driven.

### Connecting to `openagents-server`

| Variable | Default | Notes |
| --- | --- | --- |
| `OPENAGENTS_URL` | `ws://127.0.0.1:7880` | Matches this project's dev-server convention. |
| `OPENAGENTS_API_KEY` | `devkey` | Matches this project's dev-server convention. |
| `OPENAGENTS_API_SECRET` | `secret` | Matches this project's dev-server convention. |
| `OPENAGENTS_AGENT_NAME` | *(unset)* | If set, this worker only accepts explicit dispatches to this agent name instead of automatic dispatch into any room. |
| `OPENAGENTS_COWORKER_IDENTITY` | `anika-coworker` | Participant identity Anika joins rooms as. |
| `OPENAGENTS_COWORKER_NAME` | `Anika` | Participant display name. |

### Model endpoint

| Variable | Default | Notes |
| --- | --- | --- |
| `OPENAGENTS_OPENAI_BASE_URL` | **none — required** | Must be an **internal, self-hosted** OpenAI-API-compatible endpoint. Public OpenAI (`api.openai.com`) is explicitly rejected, per `AGENTS.md`. **This is intentionally left unset for now**, until a real internal endpoint exists to point it at. |
| `OPENAGENTS_OPENAI_API_KEY` | `airgap-local` | Sent to the internal endpoint; not a public OpenAI API key. |
| `OPENAGENTS_LLM_MODEL` | `gpt-4.1` | Model name as understood by the internal endpoint. |
| `OPENAGENTS_STT_MODEL` | `gpt-4o-mini-transcribe` | |
| `OPENAGENTS_TTS_MODEL` | `gpt-4o-mini-tts` | |
| `OPENAGENTS_TTS_VOICE` | `ash` | |

## Running

```bash
uv sync

# Registers with a running openagents-server and waits for job dispatch.
uv run --package openagents-coworker openagents-coworker dev
```

or, equivalently:

```bash
uv run --package openagents-coworker python -m openagents_coworker dev
```

Use the `start` subcommand instead of `dev` for production-style logging.

### What happens if `OPENAGENTS_OPENAI_BASE_URL` is unset

The worker validates this **before** attempting to connect to
`openagents-server` at all, and fails immediately with a clear message on
stderr, e.g.:

```
error: an explicit internal OpenAI-compatible base URL is required (base_url or OPENAGENTS_OPENAI_BASE_URL)
hint: set OPENAGENTS_OPENAI_BASE_URL to an internal, self-hosted OpenAI-API-compatible
endpoint (never api.openai.com). See runtime/components/openagents-coworker/README.md.
```

This is deliberate: worker registration and job dispatch do not themselves
require a model endpoint (the STT/LLM/TTS clients are only constructed once
a job is actually dispatched, inside `entrypoint`), so without this
early check the misconfiguration would otherwise surface much later, deep
inside a dispatched job, as a `ValueError` raised from
`openagents.plugins.openai.utils.get_base_url` at STT/LLM/TTS construction
time — a much more confusing place to discover it.

With `OPENAGENTS_OPENAI_BASE_URL` unset, worker registration itself still
succeeds (verified against a locally running `openagents-server`); only
these two things are expected to fail until a real internal endpoint is
configured:
- this process's own early-startup validation (fails immediately, before
  connecting to `openagents-server`), and
- an actually-dispatched job's `entrypoint`, if the early check above were
  bypassed (e.g. by calling `build_server()`/`entrypoint` directly instead of
  going through `main()`).
