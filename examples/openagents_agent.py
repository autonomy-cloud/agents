from __future__ import annotations

import atexit

from openagents import (
    Agent,
    AgentSession,
    JobContext,
    ModelEndpointConfig,
    Runtime,
    cli,
)

runtime = Runtime(models=ModelEndpointConfig.from_env())
server = runtime.agent_server()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    models = runtime.model_stack()
    session = AgentSession(
        vad=models.vad,
        stt=models.stt,
        llm=models.llm,
        tts=models.tts,
    )
    await session.start(
        agent=Agent(instructions="You are a concise internal assistant."),
        room=ctx.room,
    )


if __name__ == "__main__":
    runtime.start()
    atexit.register(runtime.stop)
    cli.run_app(server)
