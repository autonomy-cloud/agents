# Absorbed runtime components

The runtime is built from source contained in this repository. Runtime builds
must not download components or model files.

| Component | Upstream revision | Purpose |
| --- | --- | --- |
| Agent framework baseline | `02569a40794645195bd92003431e5197ea413922` | Absorbed Python agent framework |
| WebRTC server baseline | `v1.13.5` / `3b9f118327b257301083a7c4aa46076c8012918a` | WebRTC SFU and signaling |
| Python RTC baseline | `rtc-v1.1.14` / `23cbb0f33f91be9360f970980b445bb692b19b52` | Python RTC bindings |
| Protocol baseline | `2172178d20d4c8d14d6873b4e9560cc38cf48c0c` | Python protocol sources |
| Rust SDK/FFI baseline | `63128d01d955d9d8967544f46cff64a361232bf6` | Native RTC implementation |
| Nested Rust protocol | `28e604c046c6aec29757cabed341b86458cc40f9` | Rust protocol sources |
| libyuv | `917276084a49be726c90292ff0a6b0a3d571a6af` | Native YUV processing |
| libwebrtc | `webrtc-51ef663` | Pinned native WebRTC archive/build input |
| Desktop orchestration baseline (portabledesktop, MIT) | `6d29d49a2f268ca7fab93826878bf9ea8dda015d` | Xvnc-backed desktop session start/stop, absorbed into `openagents-workstation/internal/pd` |
| LiveKit server SDK baseline (server-sdk-go, Apache-2.0) | `2088dabd34424add79fd0baab2112c348838fd33` | Go room/track-publishing client, vendored into `openagents-workstation/vendor` |

Apache-2.0 license and notice files from each upstream component are preserved
inside its component directory. A release build must also generate an SBOM and
third-party license inventory for vendored Python, Go, and Rust dependencies.

## Offline dependency stores

- `openagents-server/vendor/`: Go module graph; build with `-mod=vendor`.
- `openagents-rtc/rust-sdks/vendor/`: Cargo graph with offline source replacement
  in `.cargo/config.toml`.
- `runtime/vendor/python/wheels/`: macOS ARM64 Python 3.12 wheelhouse, including
  the adapted workspace packages and embedded server runtime.
- `runtime/vendor/libwebrtc/`: the pinned native WebRTC release archive. Its
  published SHA-256 is
  `f9be49b9fee9cd1588da8a40c85bda21f5ea49c4ed82662dc889b1c919569a08`.
- `openagents-workstation/vendor/`: Go module graph (server-sdk-go,
  pion/webrtc, livekit/protocol, and their transitive deps); build with
  `-mod=vendor`. The `coder/portabledesktop` orchestration source is not a
  Go module dependency (its packages are `internal/`, so Go cannot import
  it externally) — it is instead absorbed by copy into
  `openagents-workstation/internal/pd`. VP8 encoding links dynamically
  against the system `libvpx` package (BSD-licensed) via cgo; no libvpx
  source is vendored.
