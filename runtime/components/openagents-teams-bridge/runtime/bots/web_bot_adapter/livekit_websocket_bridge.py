import logging
import asyncio
from urllib.parse import urlparse

from websockets.exceptions import ConnectionClosed
from websockets.asyncio.client import connect as websocket_connect

logger = logging.getLogger(__name__)


class LiveKitWebsocketBridge:
    """Relays LiveKit signalling websocket traffic between the in-browser
    LiveKit client and the real LiveKit server.

    In MS Teams, the page's CSP blocks the browser from connecting to the LiveKit host
    directly, so the in-browser client connects to the bot's local websocket
    server on paths under /rtc instead. This bridge forwards those
    connections (path and query string intact) to the configured LiveKit host.

    This class is only instantiated when room sync via LiveKit is configured.
    In the normal case it does not exist and the adapter's websocket handling
    is completely unchanged.
    """

    BRIDGE_PATH_PREFIX = "/rtc"

    def __init__(self, livekit_url: str):
        self.livekit_url = livekit_url

    # -- routing helpers ----------------------------------------------------

    @staticmethod
    def get_websocket_request_path(websocket):
        # websockets >= 13 exposes the request path on websocket.request.path.
        # Keep websocket.path as a fallback for older versions.
        request = getattr(websocket, "request", None)
        if request is not None:
            request_path = getattr(request, "path", None)
            if request_path:
                return request_path

        return getattr(websocket, "path", "/")

    @classmethod
    def is_bridge_path(cls, request_path) -> bool:
        return request_path == cls.BRIDGE_PATH_PREFIX or request_path.startswith(cls.BRIDGE_PATH_PREFIX + "/")

    # -- internals ----------------------------------------------------------

    def build_upstream_websocket_url(self, request_path):
        parsed_livekit_url = urlparse(self.livekit_url)

        if parsed_livekit_url.scheme not in ("ws", "wss") or not parsed_livekit_url.netloc:
            raise ValueError(f"Invalid LiveKit WebSocket URL: {self.livekit_url!r}")

        # LiveKit's Room.connect() expects a base server URL. The SDK appends
        # /rtc/... and its query string; the bridge forwards exactly that path
        # and query to the configured LiveKit host.
        if parsed_livekit_url.path not in ("", "/") or parsed_livekit_url.params or parsed_livekit_url.query or parsed_livekit_url.fragment:
            raise ValueError("LiveKit WebSocket URL must be a base URL without a path, query string, or fragment")

        if not self.is_bridge_path(request_path):
            raise ValueError(f"Unexpected LiveKit WebSocket path: {request_path!r}")

        return f"{parsed_livekit_url.scheme}://{parsed_livekit_url.netloc}{request_path}"

    def close_websocket_from_peer(self, websocket, peer_websocket):
        close_code = getattr(peer_websocket, "close_code", None)
        close_reason = getattr(peer_websocket, "close_reason", "") or ""

        # 1005, 1006, and 1015 are reserved and cannot be sent in a Close frame.
        if close_code in (None, 1005, 1006, 1015):
            close_code = 1011 if close_code == 1006 else 1000

        try:
            websocket.close(code=close_code, reason=close_reason)
        except Exception:
            pass

    # -- entry point --------------------------------------------------------

    def handle(self, browser_websocket, request_path):
        upstream_url = self.build_upstream_websocket_url(request_path)
        request_path_without_query = request_path.split("?", 1)[0]

        logger.info(
            "LiveKit WebSocket bridge connecting local path %s to %s",
            request_path_without_query,
            self.livekit_url,
        )

        asyncio.run(self._relay(browser_websocket, upstream_url))

    async def _relay(self, browser_websocket, upstream_url):
        tasks = []
        try:
            async with websocket_connect(
                upstream_url, compression=None, max_size=None,
            ) as upstream_websocket:
                async def upstream_to_browser():
                    async for message in upstream_websocket:
                        await asyncio.to_thread(browser_websocket.send, message)

                async def browser_to_upstream():
                    while True:
                        message = await asyncio.to_thread(browser_websocket.recv)
                        await upstream_websocket.send(message)

                tasks = [asyncio.create_task(upstream_to_browser()),
                         asyncio.create_task(browser_to_upstream())]
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
        except ConnectionClosed:
            pass
        except Exception as error:
            logger.warning("LiveKit WebSocket bridge error: %s", error)
        finally:
            # Unblock a pending synchronous recv before shutting down the executor.
            browser_websocket.close()
            for task in tasks:
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            logger.info("LiveKit WebSocket bridge connection closed")
