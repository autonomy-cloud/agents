"""Worker registration and job dispatch for the Anika coworker.

Builds a real ``AgentServer`` (``openagents-core``'s job-dispatch worker) that
connects to a running ``openagents-server``, registers itself, and is
dispatched into rooms by the server -- as opposed to a script that manually
joins one hardcoded room.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from openagents.agents import AgentServer, AgentSession, JobContext, JobProcess, JobRequest
from openagents.agents.log import logger
from openagents.plugins import openai, silero

from .agent import Anika
from .config import ModelConfig, WorkerConnectionConfig

VAD_USERDATA_KEY = "anika_vad"


def prewarm(proc: JobProcess) -> None:
    """Load the (comparatively slow to initialize) Silero VAD model once per
    worker process, ahead of any job being dispatched to it."""

    proc.userdata[VAD_USERDATA_KEY] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    """Runs once per dispatched job: builds the voice pipeline and starts the
    Anika agent session in the room the job was dispatched for."""

    models = ModelConfig.from_env()

    vad = ctx.proc.userdata[VAD_USERDATA_KEY]
    stt = openai.STT(model=models.stt_model, base_url=models.base_url, api_key=models.api_key)
    llm = openai.LLM(model=models.llm_model, base_url=models.base_url, api_key=models.api_key)
    tts = openai.TTS(
        model=models.tts_model,
        voice=models.tts_voice,
        base_url=models.base_url,
        api_key=models.api_key,
    )

    # Turn detection: "vad" (Silero start/end-of-speech) is AgentSession's own
    # default whenever a VAD is configured. The dedicated semantic turn-detector
    # model (openagents-plugins/livekit-plugins-turn-detector) is not wired in
    # here because that plugin directory currently contains no implementation
    # in this repo (only a .gitignore) -- see the component README for details.
    session: AgentSession[None] = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm,
        tts=tts,
    )

    await session.start(agent=Anika(), room=ctx.room)


def make_on_request(connection: WorkerConnectionConfig) -> Callable[[JobRequest], Awaitable[None]]:
    async def on_request(req: JobRequest) -> None:
        logger.info(
            "accepting job request, joining as identity=%s name=%s",
            connection.identity,
            connection.display_name,
        )
        await req.accept(identity=connection.identity, name=connection.display_name)

    return on_request


def build_server(connection: WorkerConnectionConfig | None = None) -> AgentServer:
    """Build (but do not run) the AgentServer for the Anika coworker worker."""

    connection = connection or WorkerConnectionConfig.from_env()

    server = AgentServer(
        ws_url=connection.url,
        api_key=connection.api_key,
        api_secret=connection.api_secret,
        setup_fnc=prewarm,
    )

    server.rtc_session(
        entrypoint,
        agent_name=connection.agent_name,
        on_request=make_on_request(connection),
    )

    return server


__all__ = ["AgentServer", "AgentSession", "build_server", "entrypoint", "prewarm"]
