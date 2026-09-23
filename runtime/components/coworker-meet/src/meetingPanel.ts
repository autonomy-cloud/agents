import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { mintAccessToken } from './tokenService';
import { WebviewToExtensionMessage, ExtensionToWebviewMessage } from './shared/protocol';

/** Length of the random suffix appended to a participant's LiveKit identity
 * so the same person can join from multiple sessions without colliding. */
const IDENTITY_SUFFIX_LENGTH = 8;

interface JoinConfig {
  livekitUrl: string;
  apiKey: string;
  apiSecret: string;
  roomName: string;
  displayName: string;
  coworkerIdentity: string;
}

export class MeetingPanel {
  private static current: MeetingPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onTranscriptEmitter = new vscode.EventEmitter<{ from: string; text: string }>();
  readonly onTranscript = this.onTranscriptEmitter.event;
  private connectedPromise: Promise<void>;
  private resolveConnected!: () => void;

  /** Returns the current panel, joining a room to create one if there
   * isn't one yet -- used by chatSessionProvider.ts, which doesn't want to
   * force the panel into the foreground the way createOrShow's `.reveal()`
   * does for a user-initiated "Join Meeting" click. */
  static getOrCreate(extensionUri: vscode.Uri, config: JoinConfig): MeetingPanel {
    if (MeetingPanel.current) {
      return MeetingPanel.current;
    }
    return MeetingPanel.createOrShow(extensionUri, config);
  }

  static createOrShow(extensionUri: vscode.Uri, config: JoinConfig): MeetingPanel {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (MeetingPanel.current) {
      MeetingPanel.current.panel.reveal(column);
      return MeetingPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'coworkerMeet',
      `Meet: ${config.roomName}`,
      column ?? vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist'), vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );

    MeetingPanel.current = new MeetingPanel(panel, extensionUri, config);
    return MeetingPanel.current;
  }

  /** Resolves once the webview has connected to the LiveKit room. */
  waitUntilConnected(): Promise<void> {
    return this.connectedPromise;
  }

  /** Sends a chat message into the room as the local participant, the same
   * as if they'd typed it into the panel's own chat box. */
  sendChatMessage(text: string): void {
    this.post({ type: 'sendChatMessage', text });
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly config: JoinConfig,
  ) {
    this.panel = panel;
    this.connectedPromise = new Promise((resolve) => {
      this.resolveConnected = resolve;
    });
    this.panel.webview.html = this.renderHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleMessage(message),
      null,
      this.disposables,
    );
    this.disposables.push(this.onTranscriptEmitter);
  }

  private async handleMessage(message: WebviewToExtensionMessage) {
    switch (message.type) {
      case 'ready': {
        try {
          const token = await mintAccessToken({
            apiKey: this.config.apiKey,
            apiSecret: this.config.apiSecret,
            roomName: this.config.roomName,
            identity: `${this.config.displayName}-${crypto.randomUUID().slice(0, IDENTITY_SUFFIX_LENGTH)}`,
            name: this.config.displayName,
          });
          this.post({
            type: 'init',
            livekitUrl: this.config.livekitUrl,
            token,
            roomName: this.config.roomName,
            displayName: this.config.displayName,
          });
        } catch (err) {
          vscode.window.showErrorMessage(`Coworker Meet: failed to mint LiveKit token — ${String(err)}`);
        }
        return;
      }
      case 'error': {
        vscode.window.showErrorMessage(`Coworker Meet: ${message.message}`);
        return;
      }
      case 'connected': {
        this.resolveConnected();
        return;
      }
      case 'transcript': {
        this.onTranscriptEmitter.fire({ from: message.from, text: message.text });
        return;
      }
    }
  }

  private post(message: ExtensionToWebviewMessage) {
    this.panel.webview.postMessage(message);
  }

  dispose() {
    MeetingPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  private renderHtml(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css'));
    const nonce = crypto.randomBytes(16).toString('base64');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; media-src ${webview.cspSource} blob:; connect-src https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Coworker Meet</title>
</head>
<body>
  <div id="app" class="app" data-room="${escapeHtml(this.config.roomName)}" data-coworker="${escapeHtml(this.config.coworkerIdentity)}">
    <header class="topbar">
      <div class="room-identity">
        <span class="dot dot--live" id="statusDot"></span>
        <div class="room-meta">
          <h1 id="roomTitle">${escapeHtml(this.config.roomName)}</h1>
          <span id="statusLabel" class="status-label">Connecting…</span>
        </div>
      </div>
      <div class="topbar-actions">
        <button id="toggleMicBtn" class="icon-btn" title="Toggle microphone" aria-pressed="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-2.07A7 7 0 0 0 19 12h-2Z"/></svg>
        </button>
        <button id="toggleCamBtn" class="icon-btn" title="Toggle camera" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M17 10.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4Z"/></svg>
        </button>
      </div>
    </header>

    <main class="stage">
      <div id="grid" class="video-grid"></div>
      <aside class="side-panel">
        <div class="side-panel__header">Chat</div>
        <div id="chatLog" class="chat-log"></div>
        <form id="chatForm" class="chat-form">
          <input id="chatInput" class="chat-input" type="text" placeholder="Message the room…" autocomplete="off" />
          <button type="submit" class="send-btn" title="Send">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </form>
      </aside>
    </main>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
