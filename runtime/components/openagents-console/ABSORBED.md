# Absorbed source: agents-playground

This component is absorbed (copied, then modified) from:

- Project: https://github.com/livekit/agents-playground
- License: Apache License 2.0 (see `LICENSE` and `NOTICE` in this directory)
- Upstream revision absorbed: `2a2d1dbe3317100366bc86f53f253b59394dca3c` (2026)

`agents-playground` is LiveKit's own open-source reference UI for testing and
operating voice/video AI agents (connect screen, video/audio tiles, chat,
debug panel, RPC panel). It is Apache-2.0 licensed, fully compatible with
this repo's own Apache-2.0 license — no licensing concerns, unlike code from
copyleft-licensed projects.

## Local modifications from upstream

- **Rebranding**: every visible "LiveKit" reference, logo, and external link
  removed and replaced with neutral branding ("Coworker Console"). The
  "LiveKit Cloud" sandbox-connect flow (`src/cloud/`) was removed entirely —
  this component only supports self-hosted connections (to our own
  `openagents-server`), not LiveKit's hosted cloud service.
- **Visual redesign**: card-based layout, refined color/typography tokens,
  proper empty states, replacing the original's flatter "debug console"
  aesthetic. See `tailwind.config.js` and `src/styles/globals.css` for the
  design tokens.
- **New panels**: a "Workstation" panel rendering the coworker agent's own
  desktop (published by `openagents-workstation` as a `SOURCE_SCREENSHARE`
  track) as its own tile/tab, distinct from the agent's camera feed; and a
  "Transcript" panel splitting live speech-to-text out from typed chat
  (`@livekit/components-react`'s message stream already unions chat and
  transcription messages — this component now renders them separately
  instead of interleaved).
- **Default configuration**: `.env.example` and the default `NEXT_PUBLIC_APP_CONFIG`
  point at our own local `openagents-server --dev` instance
  (`ws://127.0.0.1:7880`, `devkey`/`secret`) by default, matching the
  zero-config pattern used elsewhere in this project.

No code was taken from any source other than `livekit/agents-playground`
itself and this repo's own conventions.
