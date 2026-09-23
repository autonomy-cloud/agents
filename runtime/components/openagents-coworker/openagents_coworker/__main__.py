"""Entrypoint for the Anika coworker worker.

Usage (from this component's directory, or via ``uv run --package
openagents-coworker``)::

    uv run openagents-coworker dev     # connect + register, verbose/dev logging
    uv run openagents-coworker start   # connect + register, production mode

Configuration is entirely environment-driven; see README.md.
"""

from __future__ import annotations

import sys

from openagents.agents import cli
from openagents.agents.log import logger

from .config import ModelConfig, WorkerConnectionConfig, validate_model_config_early
from .worker import build_server


def main() -> None:
    try:
        validate_model_config_early()
    except ValueError as exc:
        logger.error("Anika coworker cannot start: %s", exc)
        print(f"error: {exc}", file=sys.stderr)
        print(
            "hint: set OPENAGENTS_OPENAI_BASE_URL to an internal, "
            "self-hosted OpenAI-API-compatible endpoint (never api.openai.com). "
            "See runtime/components/openagents-coworker/README.md.",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    connection = WorkerConnectionConfig.from_env()
    models = ModelConfig.from_env()
    logger.info(
        "starting Anika coworker worker: server=%s identity=%s model_base_url=%s llm=%s",
        connection.url,
        connection.identity,
        models.base_url,
        models.llm_model,
    )

    server = build_server(connection)
    cli.run_app(server)


if __name__ == "__main__":
    main()
