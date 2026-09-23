# Coworker Console

Coworker Console is our internal web console for joining and testing meeting
sessions with our digital coworker agents. It connects over WebRTC to our own
media server, and gives you a browser UI for audio/video, chat, transcription,
and inspecting/controlling an agent's state in real time — useful both for
manual testing and for demoing agents during development.

This is an internal fork of [LiveKit's Agents Playground](https://github.com/livekit/agents-playground),
stripped of LiveKit-hosted-cloud branding and wired to point at our own
self-hosted media server by default. It still uses the `livekit-client`,
`@livekit/components-react`, and `livekit-server-sdk` packages under the hood
— those are the WebRTC/session libraries, not a hosted service dependency.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values for your
   environment:

   ```
   LIVEKIT_API_KEY=<server API key>
   LIVEKIT_API_SECRET=<server API secret>
   NEXT_PUBLIC_LIVEKIT_URL=ws://<your media server host>:<port>
   ```

   For local development against our dev media server (run in `--dev` mode),
   the defaults are `devkey` / `secret` on `ws://127.0.0.1:7880`.

   `NEXT_PUBLIC_APP_CONFIG` in `.env.example` also lets you set the page
   title/description and toggle which settings (chat, camera, mic, etc.) are
   editable from the UI.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

4. Start your agent against the same server/credentials, connect from the
   console, and you should see it join the room.

## Notes

- The token endpoint at `src/pages/api/token.ts` mints room-join tokens
  using `livekit-server-sdk`. It's compatible with LiveKit's
  `TokenSourceEndpoint` API, so any LiveKit-client-compatible tooling can use
  it as-is.
- This is an internal tool, not a public product — expect rough edges.
