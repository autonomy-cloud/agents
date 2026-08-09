"""Session-scoped pytest fixture that bootstraps a OpenAgents server for integration tests.

Runs the repository's embedded `openagents-server` binary.
If port 7880 is already in use, assumes a server is already running and yields immediately.
"""

from __future__ import annotations

import socket
import subprocess
import time
from pathlib import Path

import pytest

OPENAGENTS_URL = "ws://localhost:7880"
OPENAGENTS_API_KEY = "devkey"
OPENAGENTS_API_SECRET = "secret"

_PORT = 7880


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _wait_for_port(port: int, timeout: float = 15.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _port_in_use(port):
            return
        time.sleep(0.3)
    raise TimeoutError(f"OpenAgents server did not start within {timeout}s (port {port})")


@pytest.fixture(scope="session")
def openagents_server():
    if _port_in_use(_PORT):
        yield
        return

    binary = Path(__file__).parents[1] / "runtime/python/openagents/bin/openagents-server"
    proc = subprocess.Popen(
        [str(binary), "--dev"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        _wait_for_port(_PORT)
        yield
    finally:
        proc.terminate()
        proc.wait(timeout=10)
