from __future__ import annotations

import datetime
import os
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

from openagents import api
from openagents.agents import AgentServer

from .config import ModelEndpointConfig, RuntimeConfig
from .models import ModelStack, create_model_stack


class Runtime:
    """Own the local OpenAgents transport process and all internal credentials."""

    def __init__(
        self,
        *,
        config: RuntimeConfig | None = None,
        models: ModelEndpointConfig | None = None,
    ) -> None:
        self.config = config or RuntimeConfig()
        self.models = models
        self._api_key = f"AK{secrets.token_hex(12)}"
        self._api_secret = secrets.token_urlsafe(48)
        self._process: subprocess.Popen[bytes] | None = None
        self._state_dir: tempfile.TemporaryDirectory[str] | None = None

    @property
    def ws_url(self) -> str:
        return f"ws://{self.config.host}:{self.config.port}"

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def start(self) -> Runtime:
        if self.is_running:
            return self

        self._state_dir = tempfile.TemporaryDirectory(prefix="openagents-")
        binary = self._resolve_server_binary()
        self._ensure_tcp_port_is_free(self.config.port, "runtime HTTP")
        self._ensure_tcp_port_is_free(self.config.rtc_tcp_port, "runtime RTC TCP")
        key_file = Path(self._state_dir.name) / "openagents-keys.yaml"
        key_file.write_text(f"{self._api_key}: {self._api_secret}\n", encoding="utf-8")
        key_file.chmod(0o600)
        config_file = Path(self._state_dir.name) / "openagents.yaml"
        config_file.write_text(
            "rtc:\n"
            f"  tcp_port: {self.config.rtc_tcp_port}\n"
            f"  port_range_start: {self.config.rtc_port_range_start}\n"
            f"  port_range_end: {self.config.rtc_port_range_end}\n",
            encoding="utf-8",
        )
        config_file.chmod(0o600)

        self._process = subprocess.Popen(
            [
                str(binary),
                "--config",
                str(config_file),
                "--bind",
                self.config.host,
                "--port",
                str(self.config.port),
                "--node-ip",
                self.config.host,
                "--key-file",
                str(key_file),
            ],
            stdin=subprocess.DEVNULL,
        )
        self._wait_until_ready()
        return self

    def stop(self) -> None:
        process = self._process
        self._process = None
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if self._state_dir is not None:
            self._state_dir.cleanup()
            self._state_dir = None

    def agent_server(self, **kwargs: Any) -> AgentServer:
        return AgentServer(
            ws_url=self.ws_url,
            api_key=self._api_key,
            api_secret=self._api_secret,
            **kwargs,
        )

    def model_stack(self) -> ModelStack:
        if self.models is None:
            raise RuntimeError("an internal model endpoint was not configured")
        return create_model_stack(self.models)

    def participant_token(
        self,
        *,
        room: str,
        identity: str,
        name: str | None = None,
        ttl: datetime.timedelta = datetime.timedelta(minutes=15),
    ) -> str:
        token = (
            api.AccessToken(self._api_key, self._api_secret)
            .with_identity(identity)
            .with_grants(api.VideoGrants(room_join=True, room=room))
            .with_ttl(ttl)
        )
        if name:
            token.with_name(name)
        return token.to_jwt()

    def __enter__(self) -> Runtime:
        return self.start()

    def __exit__(self, *_: object) -> None:
        self.stop()

    def _resolve_server_binary(self) -> Path:
        configured = self.config.server_binary
        env_binary = os.environ.get("OPENAGENTS_SERVER_BIN")
        candidates = [
            configured,
            Path(env_binary) if env_binary else None,
            Path(__file__).resolve().parent / "bin" / "openagents-server",
        ]
        embedded = Path(__file__).resolve().parent / "bin" / "openagents-server"
        for candidate in candidates:
            if not candidate or not candidate.is_file():
                continue
            if os.access(candidate, os.X_OK):
                return candidate
            if candidate == embedded and self._state_dir is not None:
                executable = Path(self._state_dir.name) / "openagents-server"
                shutil.copy2(candidate, executable)
                executable.chmod(0o700)
                return executable
        raise FileNotFoundError(
            "bundled openagents-server binary not found; build runtime/components/openagents-server "
            "and set OPENAGENTS_SERVER_BIN"
        )

    def _ensure_tcp_port_is_free(self, port: int, label: str) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((self.config.host, port))
            except OSError as exc:
                raise RuntimeError(
                    f"{label} port {self.config.host}:{port} is unavailable"
                ) from exc

    def _wait_until_ready(self) -> None:
        deadline = time.monotonic() + self.config.startup_timeout
        while time.monotonic() < deadline:
            process = self._process
            if process is None or process.poll() is not None:
                code = None if process is None else process.returncode
                self.stop()
                raise RuntimeError(f"openagents-server exited during startup with code {code}")
            try:
                with socket.create_connection(
                    (self.config.host, self.config.port), timeout=0.25
                ):
                    return
            except OSError:
                time.sleep(0.1)
        self.stop()
        raise TimeoutError("openagents-server did not become ready before the startup timeout")
