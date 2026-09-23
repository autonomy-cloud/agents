# openagents-teams-bridge — provenance

## What this is

Lets a coworker join an external Microsoft Teams meeting by URL: a headless
Chrome (Selenium, Xvfb virtual display) joins the meeting as a guest, bridges
audio both ways via the Web Audio API (`getUserMedia`/`RTCPeerConnection`
patching in-page), and relays a LiveKit-room participant's audio into the
meeting as the bot's "microphone" — and the meeting's incoming audio back out
to the LiveKit room.

## Source and license — policy exception

`runtime/` (everything except `runtime/cast_runtime/`) is imported, with
attribution only (not a clean-room rewrite), from:

- Upstream project: `attendee-labs/attendee`
- Vendored via: `autonomy-cloud/cast`, `packages/cast-meeting/runtime`, at
  commit `f40cd1fa93749532c0368864c528666327564ceb` (per that package's own
  `UPSTREAM.md`)
- License: **Elastic License 2.0 (ELv2)** — `runtime/LICENSE`,
  `Copyright (c) 2025 Attendee Labs, LLC`

**This is a deliberate, documented exception** to this repo's stated
MIT/Apache-2.0-only policy (see `AGENTS.md` and the rest of
`runtime/COMPONENTS.md`, all of which are MIT/Apache). ELv2 is a
source-available license with real restrictions — most importantly, it may
not be offered to third parties as a hosted/managed service that exposes a
substantial set of its functionality, and its license/copyright notices must
not be altered, removed, or obscured. `runtime/LICENSE` must ship with any
copy or further distribution of this component's `runtime/` tree.

`runtime/cast_runtime/` (Django settings/urls/health/bootstrap wiring) is
*not* upstream `attendee` code — it's `autonomy-cloud/cast`'s own
Apache-2.0-licensed integration glue, reused here as ordinary same-org code
reuse (no separate attribution required beyond `autonomy-cloud/cast` itself
being the origin).

## Modifications made here (beyond what `cast` already changed)

- `cast_runtime/settings.py` / `bootstrap.py`: LiveKit connection now points
  at `openagents-server` instead of Cast's LiveKit deployment (same
  `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` env var contract
  upstream already used — no code shape change).
- Service/provisioning naming ("Cast meeting transport" project name in
  `bootstrap.py`) — kept as-is where cosmetic; only renamed where it would
  otherwise be actively misleading (see git diff for exact scope).
- New `docker-compose` services (Postgres + Redis dedicated to this
  component, matching what `cast` uses via `packages/cast-docker/dev up
  --meetings`) — this repo didn't previously have either.

## Known limitations (carried over from upstream `cast`, not resolved here)

Per `cast`'s own docs at the time of import: a live external meeting join
had not yet been verified end-to-end there either — only a local voice
checkpoint confirmed audible agent replies in Teams with video disabled.
Avatar/video playback into a meeting, and other meeting platforms
(Zoom/Meet), are explicitly unverified upstream. Treat this component the
same way here until proven otherwise in this repo.
