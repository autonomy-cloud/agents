"""Builds the list of MCP toolsets Anika should have available, from
``MCPConfig``. Every server here is opt-in: if its config isn't set, it's
silently skipped rather than falling back to some public default (see
``AGENTS.md`` on why this project avoids that).

To add another MCP server (Slack, Linear, a repo-specific one, ...), add a
new opt-in field to ``MCPConfig`` and a corresponding ``if config.x_token:``
block here -- the rest of the wiring (setup/teardown, exposing the tools to
the LLM) is handled automatically by the agent framework once the toolset is
included in the list this returns.
"""

from __future__ import annotations

from openagents.agents.llm.mcp import MCPServerStdio, MCPToolset

from .config import MCPConfig


def build_mcp_toolsets(config: MCPConfig) -> list[MCPToolset]:
    toolsets: list[MCPToolset] = []

    if config.github_token:
        # Runs GitHub's own official MCP server (Go, MIT-licensed) via
        # Docker rather than requiring a separately-installed binary on the
        # host -- this stack already depends on Docker for
        # openagents-workstation and openagents-teams-bridge. See
        # https://github.com/github/github-mcp-server.
        toolsets.append(
            MCPToolset(
                id="github",
                mcp_server=MCPServerStdio(
                    command="docker",
                    args=[
                        "run",
                        "-i",
                        "--rm",
                        "-e",
                        "GITHUB_PERSONAL_ACCESS_TOKEN",
                        "ghcr.io/github/github-mcp-server",
                    ],
                    env={"GITHUB_PERSONAL_ACCESS_TOKEN": config.github_token},
                ),
            )
        )

    return toolsets
