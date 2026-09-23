# Copilot LLM Bridge

Exposes VS Code's official [Language Model API](https://code.visualstudio.com/api/extension-guides/ai/language-model)
(`vscode.lm`) — GitHub Copilot's chat models, from inside your editor — as a
local OpenAI-compatible HTTP endpoint, so any other local tool that speaks
the OpenAI chat-completions wire format can use it as a base URL.

## Why this exists, and how it's different from a Copilot-API proxy

Community tools exist that replay VS Code's own OAuth token against
`api.githubcopilot.com` directly, outside any GitHub-approved client. That's
a real ToS problem: Copilot's terms restrict access to approved clients, and
doing this can get a subscription flagged or suspended.

This extension does something different and sanctioned: it runs *inside*
VS Code, as an extension, and calls the official `vscode.lm` API — the exact
surface Microsoft/GitHub built for extensions to consume Copilot's models
programmatically, complete with the normal consent prompt on first use. It
never touches Copilot's backend directly or replays any token itself.

**Still worth being honest about**: `vscode.lm`'s intended use is in-editor
coding-assistance features, not as a general backend for an unrelated
external app. Using it to serve a separate local tool (a voice agent, a
script, whatever) is a lighter gray area than the OAuth-replay approach, but
it isn't squarely "intended use" either. Use your own judgment.

## Usage

1. Install the extension, open a workspace with GitHub Copilot signed in.
2. Run **Copilot LLM Bridge: Start** from the Command Palette (or the
   sidebar panel's Start button). The first run triggers Copilot's normal
   consent dialog — this only works from a user-initiated action, which is
   why there's no fully-silent autostart.
3. Copy the base URL (**Copilot LLM Bridge: Copy Base URL**, default
   `http://127.0.0.1:4319/v1`) into whatever tool you want to point at it —
   e.g. for `openagents-coworker` in this workspace:

   ```bash
   export OPENAGENTS_OPENAI_BASE_URL=http://127.0.0.1:4319/v1
   export OPENAGENTS_OPENAI_API_KEY=unused   # the bridge doesn't check this unless you set a shared secret below
   ```

4. **VS Code has to stay open** with this extension active for requests to
   be served — there's no persistent background process once VS Code
   closes.

## Routing to another VS Code+Copilot instance's chat

`@remote` is a chat participant: `@`-mention it in your own Copilot Chat and
it forwards your message to *another* VS Code window's (or another
machine's) Copilot LLM Bridge, streaming that instance's reply back into
your chat. There's no built-in VS Code API for chat-to-chat routing across
windows or machines — this works by having both sides run this same
extension, one as the HTTP server the other calls into.

Configure one or more targets in settings.json:

```json
"copilotLlmBridge.remoteTargets": [
  { "name": "work", "baseUrl": "http://127.0.0.1:4319/v1" }
]
```

- `baseUrl` is the *other* instance's bridge base URL — same-machine (a
  different window) it's `http://127.0.0.1:<their port>/v1`; a different
  machine needs that port reachable somehow (a tailnet, an SSH tunnel —
  nothing here punches through NAT or exposes it publicly on its own).
- `sharedSecret`, if the target instance set `copilotLlmBridge.sharedSecret`.
- With exactly one target configured, `@remote <message>` just uses it.
  With more than one, prefix the target's name: `@remote @work <message>`.

The target instance must have its own bridge already started
(**Copilot LLM Bridge: Start**) — `@remote` is a client of that HTTP
endpoint, same as any other OpenAI-SDK-compatible caller.

## Endpoints

- `POST /v1/chat/completions` — standard OpenAI chat-completions shape,
  `stream: true` supported (SSE).
- `GET /v1/models` — lists whatever `vendor`/`family` selector is
  configured.
- `GET /healthz`

The server only ever binds to `127.0.0.1`. Set `copilotLlmBridge.sharedSecret`
in settings to also require an `Authorization: Bearer <token>` header from
callers, for defense in depth on a shared machine.

## Known limitations

- **No system-role support upstream**: the Language Model API has no system
  message concept. This bridge folds all system messages into a synthetic
  leading user/assistant exchange — good enough for instructions, not a
  perfect equivalent.
- **No OpenAI function/tool-calling translation**: the Language Model API
  has its own, differently-shaped tool-calling surface
  (`LanguageModelChatTool`). This bridge doesn't translate between the two,
  so a client that relies on OpenAI-style `tools`/`tool_calls` (like
  `openagents-coworker`'s MCP toolsets) won't get real tool calls through
  this bridge — only plain chat. Worth building if you need it; out of
  scope for this first version.
- **No token usage accounting**: `usage` in responses is always zero: the
  Language Model API doesn't expose token counts.

## Development

```bash
npm install
npm run watch   # or: npm run build
```

Press F5 in VS Code to launch an Extension Development Host.
