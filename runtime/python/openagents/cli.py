from __future__ import annotations

import argparse
import signal
import threading

from .config import RuntimeConfig
from .runtime import Runtime


def main() -> None:
    parser = argparse.ArgumentParser(prog="openagents")
    parser.add_argument("command", choices=["serve"])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7880)
    parser.add_argument("--rtc-tcp-port", type=int, default=7881)
    parser.add_argument("--rtc-port-range-start", type=int, default=50000)
    parser.add_argument("--rtc-port-range-end", type=int, default=60000)
    args = parser.parse_args()

    runtime = Runtime(
        config=RuntimeConfig(
            host=args.host,
            port=args.port,
            rtc_tcp_port=args.rtc_tcp_port,
            rtc_port_range_start=args.rtc_port_range_start,
            rtc_port_range_end=args.rtc_port_range_end,
        )
    )
    stopped = threading.Event()

    def request_stop(*_: object) -> None:
        stopped.set()

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    with runtime:
        print(f"OpenAgents runtime listening at {runtime.ws_url}")
        stopped.wait()


if __name__ == "__main__":
    main()
