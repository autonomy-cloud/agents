import { NextApiRequest, NextApiResponse } from "next";

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

export type AgentSummary = {
  name: string;
  description?: string;
  // "live" = a currently-connected worker, read from the server's
  // /debug/agents endpoint. "configured" = a static entry from
  // NEXT_PUBLIC_APP_CONFIG's known_agents, offered even when nothing is
  // currently connected under that name (e.g. so the field can be filled in
  // before the worker happens to be running).
  source: "live" | "configured";
  status?: string;
};

export type AgentsResponse = {
  agents: AgentSummary[];
  error?: string;
};

type DebugAgentEntry = {
  agentName?: string;
  status?: string;
};

function debugAgentsUrl(): string | undefined {
  if (!livekitUrl) return undefined;
  // /debug/agents is served over plain HTTP(S) on the same host/port the
  // WS signaling URL uses.
  return livekitUrl.replace(/^ws/, "http") + "/debug/agents";
}

// This route merges two sources of agent names for the Settings panel's
// Agent name dropdown:
//   1. Live, currently-registered workers, from openagents-server's
//      /debug/agents endpoint (dev-mode only — see
//      runtime/components/openagents-server/pkg/service/server.go). Workers
//      with no agentName set (the default, automatic-dispatch worker) are
//      excluded here since an empty name isn't a usable explicit-dispatch
//      value.
//   2. Statically configured entries from NEXT_PUBLIC_APP_CONFIG's
//      known_agents, so the dropdown isn't empty just because nothing
//      happens to be connected right now.
// Like /api/rooms, this never throws a raw 500: an unreachable or
// non-dev-mode server just means no "live" entries, not a broken dropdown.
export default async function handleAgents(
  req: NextApiRequest,
  res: NextApiResponse<AgentsResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ agents: [], error: "Method Not Allowed" });
    return;
  }

  const url = debugAgentsUrl();
  if (!url) {
    res.status(200).json({
      agents: [],
      error: "Server environment variables aren't set up correctly",
    });
    return;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) {
      // Most commonly: server isn't running in --dev mode, so /debug/agents
      // doesn't exist. Not an error worth surfacing loudly.
      res.status(200).json({ agents: [] });
      return;
    }
    const entries = (await response.json()) as DebugAgentEntry[];
    const agents: AgentSummary[] = entries
      .filter((entry) => entry.agentName)
      .map((entry) => ({
        name: entry.agentName as string,
        source: "live",
        status: entry.status,
      }));
    res.status(200).json({ agents });
  } catch (err) {
    console.error("Error listing live agents:", err);
    res.status(200).json({
      agents: [],
      error: "Could not reach the server to list connected agents",
    });
  }
}
