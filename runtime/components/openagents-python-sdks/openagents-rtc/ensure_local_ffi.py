"""Fail closed when an offline wheel is built without a source-built FFI library."""

from __future__ import annotations

import platform
import sys
from pathlib import Path


def expected_library() -> str:
    if sys.platform == "darwin":
        return "libopenagents_ffi.dylib"
    if sys.platform == "linux":
        return "libopenagents_ffi.so"
    if sys.platform == "win32":
        return "livekit_ffi.dll"
    raise RuntimeError(f"unsupported build platform: {platform.system()}")


library = Path(__file__).parent / "livekit" / "rtc" / "resources" / expected_library()
if not library.is_file():
    raise RuntimeError(
        f"{library.name} is missing. Build livekit-ffi from the absorbed rust-sdks source "
        "and copy it into livekit/rtc/resources before building the wheel. Network "
        "downloads are intentionally disabled."
    )

