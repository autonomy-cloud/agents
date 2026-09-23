# openagents-workstation

A self-contained Go program that gives an AI coworker a real Linux desktop
it can see: it starts an `Xvnc`-backed X11 session, captures its screen with
an original RFB (VNC) client, encodes frames as VP8, and publishes them as a
`SOURCE_SCREENSHARE` LiveKit video track into a room on `openagents-server`
(this repo's fork of `livekit-server`). Any client viewing that room (e.g.
the Coworker Console app) sees it as a normal video tile.

No headless browser, no CEF, no Nix build, no window manager. See
`NOTICE.md` for what was absorbed from where and why.

## Layout

```
cmd/openagents-workstation/  entrypoint: orchestrates desktop -> capture -> publish
internal/rfb/                original RFB (VNC) protocol client + Raw-encoding decoder
internal/capture/            polls the RFB client at a fixed frame rate
internal/vpxenc/             cgo binding to libvpx for VP8 encoding
internal/pd/desktop/         absorbed from coder/portabledesktop (MIT) — starts/stops Xvnc
internal/pd/runtime/         absorbed from coder/portabledesktop (MIT) — runtime dir resolution
vendor/                      go mod vendor of server-sdk-go, pion/webrtc, livekit/protocol, etc.
Dockerfile                   apt-based runtime (Xvnc, xdotool, ffmpeg, libvpx) + Go build
```

## How the pieces fit together

1. **Desktop.** `internal/pd/desktop.Start` (absorbed from
   `coder/portabledesktop`, MIT-licensed — see `NOTICE.md`) spawns `Xvnc` in
   the configured runtime directory. No window manager or icon dock is
   started (`Openbox: false`, `Dock: false`): a bare X server showing
   whatever the AI coworker's tools draw into it is all this component
   needs.
2. **Capture.** `internal/rfb` is a small, original RFB/VNC client (RFC
   6143): it does the version/security/ClientInit-ServerInit handshake
   against `Xvnc` with `-SecurityTypes None`, requests a fixed 32bpp pixel
   format, advertises only the mandatory Raw encoding, and decodes
   `FramebufferUpdate` rectangles into `image.RGBA` frames.
   `internal/capture` polls it on a timer and hands the latest frame to the
   publisher.
3. **Encode.** `internal/vpxenc` is a small cgo binding to libvpx's public
   encoder API (`vpx_codec_encode` / `vpx_codec_get_cx_data`) that turns
   `image.RGBA` frames into VP8 bitstream frames. `server-sdk-go`'s
   `LocalTrack` publishes already-encoded `media.Sample`s (see its own
   `examples/videotracke2ee`); it has no built-in video encoder, so this is
   the missing piece the SDK expects the caller to supply. libvpx itself is
   BSD-licensed and dynamically linked via the `libvpx-dev`/`libvpx7`
   Debian packages in the Dockerfile — no libvpx source is vendored.
4. **Publish.** `cmd/openagents-workstation` connects to the room via
   `lksdk.ConnectToRoom`, creates a `lksdk.NewLocalTrack` with
   `MimeType: webrtc.MimeTypeVP8`, and calls
   `LocalParticipant.PublishTrack` with
   `Source: livekit.TrackSource_SCREEN_SHARE`.

## Runtime directory contract

The absorbed `internal/pd/runtime.ValidateRuntimeDir` only requires
`<PORTABLEDESKTOP_RUNTIME_DIR>/bin/Xvnc` to exist; everything else
(`xdotool` for input, `ffmpeg` for recording) resolves with a fallback to
bare `$PATH` if not present under the runtime dir. The Dockerfile installs
`tigervnc-standalone-server` (provides `Xvnc`), `xdotool`, and `ffmpeg` via
`apt-get`, and symlinks the installed `Xvnc` into
`/opt/portabledesktop-runtime/bin/Xvnc`.

## Build

```bash
# local (macOS/Linux with libvpx installed, e.g. `brew install libvpx` or
# `apt-get install libvpx-dev`):
CGO_ENABLED=1 go build ./...
go vet ./...

# container image:
docker build -t openagents-workstation .
```

## Run

Point it at a running `openagents-server --dev` instance:

```bash
docker run --rm \
  --network host \
  -e OPENAGENTS_URL=ws://127.0.0.1:7880 \
  -e OPENAGENTS_API_KEY=devkey \
  -e OPENAGENTS_API_SECRET=secret \
  -e ROOM_NAME=coworker-standup \
  -e COWORKER_IDENTITY=anika-coworker-desktop \
  openagents-workstation
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENAGENTS_URL` | `ws://127.0.0.1:7880` | WebSocket URL of the openagents-server/LiveKit instance |
| `OPENAGENTS_API_KEY` | `devkey` | API key |
| `OPENAGENTS_API_SECRET` | `secret` | API secret |
| `ROOM_NAME` | `coworker-standup` | Room to join |
| `COWORKER_IDENTITY` | `anika-coworker-desktop` | Participant identity used when publishing |
| `PORTABLEDESKTOP_RUNTIME_DIR` | `/opt/portabledesktop-runtime` | Directory containing `bin/Xvnc` |
| `WORKSTATION_GEOMETRY` | `1280x800` | Xvnc desktop geometry |
| `WORKSTATION_FPS` | `15` | Capture/encode frame rate |
| `WORKSTATION_BITRATE_KBPS` | `2000` | VP8 target bitrate |

## License

This component is part of the Apache-2.0 `agents` repository. It absorbs:

- `coder/portabledesktop` (MIT) — see `internal/pd/LICENSE` and
  `internal/pd/NOTICE.md`.
- `livekit/server-sdk-go` and its transitive dependencies (Apache-2.0/MIT/
  BSD), vendored under `vendor/` via `go mod vendor` — see each package's
  license file there.

No AGPL or other copyleft-licensed source was used. In particular, no code
was taken from `coder/coder` (the AGPLv3 monorepo containing
`agent/x/agentdesktop`), which was deliberately avoided in favor of the
separately MIT-licensed `coder/portabledesktop` project.
