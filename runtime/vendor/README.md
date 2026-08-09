# Offline artifact store

This directory contains the immutable binary inputs needed to install and build
OpenAgents without internet access.

The checked-in bundle currently targets Python 3.12 on macOS ARM64. Install it
with:

```sh
python3.12 -m pip install --no-index \
  --find-links runtime/vendor/python/wheels \
  openagents-runtime==0.1.0
```

The native RTC build consumes the pinned libwebrtc archive locally:

```sh
unzip runtime/vendor/libwebrtc/webrtc-mac-arm64-release.zip -d /tmp/openagents-webrtc
export LK_CUSTOM_WEBRTC=/tmp/openagents-webrtc/mac-arm64-release
```

`SHA256SUMS` covers the distributable archives, wheels, embedded OpenAgents server,
and staged RTC FFI library. Verify it from the repository root with:

```sh
shasum -a 256 -c runtime/vendor/SHA256SUMS
```

Linux AMD64 requires a separately produced wheelhouse, OpenAgents server binary,
RTC FFI library, and matching libwebrtc archive. It does not require a cloud
service, but native artifacts cannot be reused across operating systems or CPU
architectures.
