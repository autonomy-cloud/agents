# openagents-workstation: a real Linux desktop (Xvnc), captured over an
# original RFB client and published as a LiveKit screen-share video track.
#
# No Nix, no embedded portabledesktop runtime tarball, no downloaded
# prebuilt binaries: the runtime directory required by the absorbed
# portabledesktop orchestration code (internal/pd) is assembled here purely
# from Debian packages, and the Go binary is built from source vendored in
# this repository (vendor/, go build -mod=vendor).

FROM golang:1.26-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libvpx-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY go.mod go.sum ./
COPY vendor/ vendor/
COPY cmd/ cmd/
COPY internal/ internal/

RUN CGO_ENABLED=1 GO111MODULE=on go build -mod=vendor -o /out/openagents-workstation ./cmd/openagents-workstation

FROM debian:bookworm-slim

# The runtime directory contract (see internal/pd/runtime/resolve.go,
# absorbed from portabledesktop) requires only <dir>/bin/Xvnc. xdotool
# (keyboard/mouse input) and ffmpeg (recording) are resolved with a
# fallback to bare PATH if not present under the runtime dir, so they are
# simply installed on PATH here rather than symlinked into the runtime
# dir.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tigervnc-standalone-server \
    xdotool \
    ffmpeg \
    libvpx7 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/portabledesktop-runtime/bin \
    && ln -s "$(command -v Xvnc)" /opt/portabledesktop-runtime/bin/Xvnc

COPY --from=builder /out/openagents-workstation /usr/local/bin/openagents-workstation

ENV PORTABLEDESKTOP_RUNTIME_DIR=/opt/portabledesktop-runtime \
    OPENAGENTS_URL=ws://127.0.0.1:7880 \
    OPENAGENTS_API_KEY=devkey \
    OPENAGENTS_API_SECRET=secret \
    ROOM_NAME=coworker-standup \
    COWORKER_IDENTITY=anika-coworker \
    WORKSTATION_GEOMETRY=1280x800 \
    WORKSTATION_FPS=15 \
    WORKSTATION_BITRATE_KBPS=2000

ENTRYPOINT ["/usr/local/bin/openagents-workstation"]
