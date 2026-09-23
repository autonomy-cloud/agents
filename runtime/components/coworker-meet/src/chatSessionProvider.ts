import * as vscode from 'vscode';
import { MeetingPanel } from './meetingPanel';
import { EmbeddedServerManager } from './embeddedServer';
import { resolveConnection, SETTINGS_SECTION } from './connectionResolver';
import { DEFAULT_ROOM_NAME, DEFAULT_COWORKER_IDENTITY } from './shared/constants';

export const CHAT_SESSION_TYPE = 'anika-coworker';

/**
 * Gives Anika a real chat session -- shown in VS Code's Chat view and the
 * Agents Window sessions list -- backed by the *actual* coworker agent
 * (openagents-coworker, dispatched into a real LiveKit room), not a
 * reimplementation against vscode.lm. A message typed into this session is
 * relayed into the room over the same TOPIC_CHAT text stream the meeting
 * panel's own chat box uses (see meetingPanel.ts / webview/main.ts); the
 * agent's reply comes back the same way room_io publishes it, over
 * TOPIC_TRANSCRIPTION.
 *
 * Uses `chatSessionsProvider`, a *proposed* (unstable) VS Code API -- see
 * this extension's README for what that means and how to run with it
 * enabled.
 */
export class AnikaChatSessionProvider implements vscode.ChatSessionContentProvider {
  private readonly onDidChangeChatSessionOptionsEmitter = new vscode.EventEmitter<vscode.ChatSessionOptionChangeEvent>();
  readonly onDidChangeChatSessionOptions = this.onDidChangeChatSessionOptionsEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly embeddedServer: EmbeddedServerManager,
  ) {}

  private async ensurePanel(): Promise<MeetingPanel> {
    const connection = await resolveConnection(this.context, this.embeddedServer);
    if (!connection) {
      throw new Error('Could not resolve a LiveKit connection (server not running / API secret not set)');
    }

    const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
    const roomName = config.get<string>('roomName', DEFAULT_ROOM_NAME);
    const coworkerIdentity = config.get<string>('coworkerIdentity', DEFAULT_COWORKER_IDENTITY);
    const displayName =
      config.get<string>('displayName', '') || process.env.USER || process.env.USERNAME || 'You';

    const panel = MeetingPanel.getOrCreate(this.extensionUri, {
      ...connection,
      roomName,
      displayName,
      coworkerIdentity,
    });
    await panel.waitUntilConnected();
    return panel;
  }

  provideChatSessionContent(
    resource: vscode.Uri,
    token: vscode.CancellationToken,
  ): vscode.ChatSession {
    const requestHandler: vscode.ChatRequestHandler = async (request, _context, stream, requestToken) => {
      let panel: MeetingPanel;
      try {
        stream.progress('Connecting to Anika...');
        panel = await this.ensurePanel();
      } catch (err) {
        stream.markdown(`⚠️ Could not reach Anika: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (requestToken.isCancellationRequested) {
        return;
      }

      await new Promise<void>((resolve) => {
        const subscription = panel.onTranscript(({ text }) => {
          stream.markdown(text);
          subscription.dispose();
          resolve();
        });
        requestToken.onCancellationRequested(() => {
          subscription.dispose();
          resolve();
        });
        panel.sendChatMessage(request.prompt);
      });
    };

    return {
      history: [],
      requestHandler,
    };
  }
}

/** Backs the sessions list shown in the Chat view / Agents Window for this
 * session type -- just one static "Anika" item, since this extension only
 * ever has the one coworker room, not a general multi-session backend. */
export function registerAnikaChatSession(
  context: vscode.ExtensionContext,
  embeddedServer: EmbeddedServerManager,
): void {
  const provider = new AnikaChatSessionProvider(context.extensionUri, context, embeddedServer);

  const defaultParticipant: vscode.ChatParticipant = vscode.chat.createChatParticipant(
    `${CHAT_SESSION_TYPE}.participant`,
    async () => {
      /* unused: chat sessions route through provideChatSessionContent's own
       * requestHandler, not this participant's own handler. */
    },
  );
  defaultParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'activity-icon.svg');
  context.subscriptions.push(defaultParticipant);

  context.subscriptions.push(
    vscode.chat.registerChatSessionContentProvider(CHAT_SESSION_TYPE, provider, defaultParticipant, {
      supportsInterruptions: true,
    }),
  );

  const controller = vscode.chat.createChatSessionItemController(CHAT_SESSION_TYPE, async () => {
    // Static: always exactly one "Anika" session item, nothing to discover.
  });
  context.subscriptions.push(controller);

  const item = controller.createChatSessionItem(
    vscode.Uri.parse(`${CHAT_SESSION_TYPE}:anika`),
    'Anika',
  );
  item.description = 'Your digital coworker';
  item.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'activity-icon.svg');
  controller.items.add(item);
}
