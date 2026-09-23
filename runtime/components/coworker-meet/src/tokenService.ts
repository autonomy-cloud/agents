import { AccessToken } from 'livekit-server-sdk';

/** How long a minted room-access token remains valid for. */
const TOKEN_TTL = '2h';

export interface TokenRequest {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  identity: string;
  name: string;
  /** Grant permission to publish an extra video track (e.g. an avatar) for this identity. */
  canPublish?: boolean;
}

export async function mintAccessToken(req: TokenRequest): Promise<string> {
  const at = new AccessToken(req.apiKey, req.apiSecret, {
    identity: req.identity,
    name: req.name,
    ttl: TOKEN_TTL,
  });
  at.addGrant({
    room: req.roomName,
    roomJoin: true,
    canPublish: req.canPublish ?? true,
    canPublishData: true,
    canSubscribe: true,
  });
  return at.toJwt();
}
