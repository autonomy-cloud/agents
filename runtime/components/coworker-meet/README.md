# Coworker Meet

Join a LiveKit meeting from inside VS Code, and give your digital coworker a
seat in the room, without leaving the editor.

## What works today

- `Coworker Meet: Join Meeting` opens a webview panel that connects to a
  LiveKit room using the real browser LiveKit client (`livekit-client`), with
  live mic/camera publish and a video grid for every participant.
- The extension host mints short-lived LiveKit access tokens locally via
  `livekit-server-sdk` — your API secret never leaves your machine.
- A chat panel sends/receives messages over the same LiveKit text-stream
  topics (`lk.chat` outbound, `lk.transcription` inbound) that
  `openagents-core`'s `room_io` actually listens on and replies over — not a
  raw data-channel broadcast other humans would see but the agent wouldn't.
- The coworker's identity gets a distinct tile and badge in the grid so it
  reads as a teammate, not a bot account.
- **`Coworker Meet: Open Coworker Window`** opens Anika as a real VS Code
  chat session — visible in the Chat view and the Agents Window's sessions
  list, with her own branding — backed by the same real LiveKit room, in a
  dedicated new VS Code window. See "Anika as a chat session" below.

## How the coworker actually joins

There is no client-side "agent bridge" in this extension — a real coworker
is a separate worker process (`openagents-coworker` in `autonomy-cloud/agents`)
that registers with the LiveKit/`openagents-server` and gets job-dispatched
into a room automatically. This extension just joins the room like any other
participant; chat goes over the `lk.chat`/`lk.transcription` text-stream
topics `room_io` listens on and publishes over (`webview/main.ts`'s
`sendChatText`), so the dispatched agent sees and responds to it — no
extension-host relay needed for that part.

## Anika as a chat session (proposed API)

`chatSessionProvider.ts` registers Anika as a real chat session type via
`vscode.chat.registerChatSessionContentProvider` — the same kind of
extension point Copilot/Claude/Codex sessions use, so she shows up in VS
Code's Chat view and the Agents Window, not just this extension's own
webview panel. A message sent there relays into the same LiveKit room via
`meetingPanel.ts`'s `sendChatMessage`/`onTranscript`, so it's backed by the
real agent, not a reimplementation.

**This depends on `chatSessionsProvider`, a proposed (unstable) VS Code
API** — not something Microsoft has published a marketplace-stable version
of yet. Concretely, that means:

- It can change shape or break on a VS Code update with no deprecation
  notice. `vscode.proposed.chatSessionsProvider.d.ts` in this repo's root is
  a point-in-time copy fetched from `microsoft/vscode`; re-fetch it (`npx
  @vscode/dts dev chatSessionsProvider`, run from a colon-free path if your
  checkout has one — see this org's `colon-path-npx-workaround` memory) if
  compilation starts failing after a VS Code update.
- It needs either VS Code Insiders, or VS Code Stable launched with
  `--enable-proposed-api autonomy-cloud.coworker-meet`.
- `Coworker Meet: Open Coworker Window` opens a genuinely new VS Code
  window and auto-focuses the Chat view there (`workbench.view.chat`) — VS
  Code doesn't offer a supported way to deep-link straight into one
  specific registered session across a window boundary, so picking "Anika"
  from the session list once it opens is one extra click, not automatic.

Avatar/workstation video works the same way: any process (`openagents-workstation`,
or the coworker agent itself) can publish a video track under the coworker's
identity directly into the room, and it shows up in this grid automatically,
same as any other participant's camera.

## Setup

1. `npm install`
2. `npm run build` (or `npm run watch` while developing)
3. Press F5 in VS Code to launch an Extension Development Host
4. Set `coworkerMeet.livekitUrl` and `coworkerMeet.apiKey` in Settings
5. Run `Coworker Meet: Set API Secret` (stored in VS Code SecretStorage,
   not settings.json)
6. Run `Coworker Meet: Join Meeting`

## Architecture

```
extension.ts            activation, commands, config/secret loading
connectionResolver.ts   resolves embedded vs. advanced mode into a LiveKit connection
embeddedServer.ts       spawns/manages the bundled local LiveKit server (embedded mode)
meetingPanel.ts         webview lifecycle, HTML shell, token minting, message routing
chatSessionProvider.ts  registers Anika as a chat session (proposed chatSessionsProvider API)
tokenService.ts         LiveKit AccessToken generation (livekit-server-sdk)
shared/protocol.ts       extension<->webview postMessage types (used by both sides)
shared/constants.ts      small defaults shared between the extension host and webview
webview/main.ts          LiveKit room join, video grid, chat (livekit-client, browser)
webview/style.css        UI
```

`vscode.proposed.chatSessionsProvider.d.ts` at the repo root is a fetched
copy of the proposed API declaration this extension type-checks against —
see "Anika as a chat session" above.

`bin/` (the prebuilt embedded server binary produced by `npm run build:server`)
is a local build artifact and is git-ignored — see `scripts/build-server.mjs`.
