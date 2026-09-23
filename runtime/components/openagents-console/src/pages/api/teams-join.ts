import { NextApiRequest, NextApiResponse } from "next";

const teamsBridgeUrl = process.env.TEAMS_BRIDGE_URL || "http://127.0.0.1:7000";
const teamsBridgeToken = process.env.TEAMS_BRIDGE_API_TOKEN;

export type TeamsJoinResponse = {
  botId?: string;
  state?: string;
  error?: string;
};

// Proxies a "join this Teams meeting" request to openagents-teams-bridge's
// internal API (see runtime/components/openagents-teams-bridge/ABSORBED.md
// for what that service is). Server-side only: the bridge's service token
// never reaches the browser, same pattern as rooms.ts/agents.ts.
export default async function handleTeamsJoin(
  req: NextApiRequest,
  res: NextApiResponse<TeamsJoinResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  if (!teamsBridgeToken) {
    res.status(200).json({
      error:
        "TEAMS_BRIDGE_API_TOKEN isn't set — start the bridge with ENABLE_TEAMS_BRIDGE=1 " +
        "via scripts/dev-up.sh, then export the token it generates into " +
        ".env.teams-bridge for this console process too.",
    });
    return;
  }

  const { meetingUrl, roomName, sourceIdentity } = req.body ?? {};
  if (typeof meetingUrl !== "string" || !meetingUrl.trim()) {
    res.status(200).json({ error: "A meeting URL is required" });
    return;
  }
  if (typeof roomName !== "string" || !roomName.trim()) {
    res.status(200).json({ error: "No active room to bridge into" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(meetingUrl.trim());
  } catch {
    res.status(200).json({ error: "That doesn't look like a valid URL" });
    return;
  }
  const allowedHosts = new Set(["teams.microsoft.com", "teams.live.com"]);
  if (
    parsed.protocol !== "https:" ||
    !allowedHosts.has(parsed.hostname.toLowerCase())
  ) {
    res
      .status(200)
      .json({ error: "Only https teams.microsoft.com / teams.live.com meeting links are supported" });
    return;
  }

  const payload: Record<string, unknown> = {
    meeting_url: parsed.toString(),
    bot_name: "Anika",
    deduplication_key: `openagents:${roomName}:${Date.now()}`,
    metadata: { room_name: roomName },
    room_sync_settings: {
      sync_to_room: true,
      livekit: {
        room_name: roomName,
        ...(sourceIdentity
          ? { source_participant: { identity: sourceIdentity } }
          : {}),
      },
    },
    recording_settings: { format: "none" },
    transcription_settings: { meeting_closed_captions: {} },
  };

  try {
    const response = await fetch(
      teamsBridgeUrl.replace(/\/$/, "") + "/internal/meetings/v1/bots",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${teamsBridgeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(200).json({
        error: `Teams bridge returned HTTP ${response.status}`,
      });
      return;
    }
    res.status(200).json({ botId: body.id, state: body.state });
  } catch (err) {
    console.error("Error requesting Teams join:", err);
    res.status(200).json({ error: "Could not reach the Teams bridge service" });
  }
}
