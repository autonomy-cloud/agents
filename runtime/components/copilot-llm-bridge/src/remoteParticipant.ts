import * as vscode from 'vscode';

export interface RemoteTarget {
  name: string;
  baseUrl: string;
  sharedSecret?: string;
}

function getTargets(): RemoteTarget[] {
  return vscode.workspace
    .getConfiguration('copilotLlmBridge')
    .get<RemoteTarget[]>('remoteTargets', []);
}

/** Parses a leading "@targetName " prefix off the prompt, if present. */
function extractTarget(prompt: string, targets: RemoteTarget[]): { target: RemoteTarget | undefined; rest: string } {
  const match = prompt.match(/^@(\S+)\s+([\s\S]*)$/);
  if (match) {
    const found = targets.find((t) => t.name === match[1]);
    if (found) {
      return { target: found, rest: match[2] };
    }
  }
  return { target: undefined, rest: prompt };
}

async function* streamRemoteCompletion(
  target: RemoteTarget,
  prompt: string,
  token: vscode.CancellationToken,
): AsyncGenerator<string> {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());

  const response = await fetch(target.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(target.sharedSecret ? { Authorization: `Bearer ${target.sharedSecret}` } : {}),
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new Error(`Remote bridge returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice('data:'.length).trim();
      if (data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') yield delta;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

/**
 * Registers `@remote`: a chat participant that forwards the prompt to
 * *another* VS Code+Copilot instance's own Copilot LLM Bridge (this same
 * extension, running there) and streams its reply back into this chat --
 * routing a request from your Copilot Chat to another window's or another
 * machine's Copilot Chat, via each side's local HTTP bridge.
 *
 * Configure targets via `copilotLlmBridge.remoteTargets` in settings.json;
 * each target needs the other instance's bridge running and started there.
 */
export function registerRemoteParticipant(context: vscode.ExtensionContext): void {
  const handler: vscode.ChatRequestHandler = async (request, _context, stream, token) => {
    const targets = getTargets();
    if (targets.length === 0) {
      stream.markdown(
        '⚠️ No remote targets configured. Add one or more to `copilotLlmBridge.remoteTargets` in settings.json, ' +
          'e.g.:\n```json\n"copilotLlmBridge.remoteTargets": [\n  { "name": "work", "baseUrl": "http://127.0.0.1:4319/v1" }\n]\n```',
      );
      return;
    }

    const { target: explicitTarget, rest } = extractTarget(request.prompt, targets);
    let target = explicitTarget;

    if (!target) {
      if (targets.length === 1) {
        target = targets[0];
      } else {
        const names = targets.map((t) => `\`@${t.name}\``).join(', ');
        stream.markdown(
          `Multiple remote targets are configured (${names}). Prefix your message with the target's ` +
            `name, e.g. \`@remote @${targets[0].name} <your message>\`.`,
        );
        return;
      }
    }

    stream.progress(`Forwarding to ${target.name} (${target.baseUrl})...`);

    try {
      for await (const fragment of streamRemoteCompletion(target, rest, token)) {
        stream.markdown(fragment);
      }
    } catch (err) {
      stream.markdown(`⚠️ Request to \`${target.name}\` failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const participant = vscode.chat.createChatParticipant('copilotLlmBridge.remote', handler);
  participant.iconPath = new vscode.ThemeIcon('remote');
  context.subscriptions.push(participant);
}
