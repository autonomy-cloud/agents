import { NextApiRequest, NextApiResponse } from "next";

import { RoomServiceClient } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

export type RoomSummary = {
  name: string;
  numParticipants: number;
};

export type RoomsResponse = {
  rooms: RoomSummary[];
  error?: string;
};

// This route lists currently active rooms on the configured server, so the
// Settings panel can offer them as rejoinable options. It never throws a raw
// 500 for a missing/unreachable server: the frontend always gets a 200 with
// an (possibly empty) room list, plus an `error` string it can choose to
// surface, so a misconfigured or offline server degrades gracefully instead
// of breaking the dropdown.
export default async function handleRooms(
  req: NextApiRequest,
  res: NextApiResponse<RoomsResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ rooms: [], error: "Method Not Allowed" });
    return;
  }

  if (!apiKey || !apiSecret || !livekitUrl) {
    res.status(200).json({
      rooms: [],
      error: "Server environment variables aren't set up correctly",
    });
    return;
  }

  try {
    const client = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    const rooms = await client.listRooms();
    res.status(200).json({
      rooms: rooms.map((room) => ({
        name: room.name,
        numParticipants: room.numParticipants,
      })),
    });
  } catch (err) {
    console.error("Error listing rooms:", err);
    res.status(200).json({
      rooms: [],
      error: "Could not reach the server to list active rooms",
    });
  }
}
