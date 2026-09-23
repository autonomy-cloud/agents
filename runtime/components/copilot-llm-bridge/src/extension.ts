import * as http from 'node:http';
import * as vscode from 'vscode';
import { CopilotClient } from './copilotClient';
import { startServer } from './server';
import { registerRemoteParticipant } from './remoteParticipant';

interface BridgeState {
  running: boolean;
  starting: boolean;
  port: number;
  baseUrl: string;
  modelName: string | null;
  error: string | null;
}

function config() {
  const cfg = vscode.workspace.getConfiguration('copilotLlmBridge');
  return {
    port: cfg.get<number>('port', 4319),
    vendor: cfg.get<string>('vendor', 'copilot'),
    family: cfg.get<string>('family', ''),
    autoStart: cfg.get<boolean>('autoStart', false),
    sharedSecret: cfg.get<string>('sharedSecret', ''),
  };
}

function modelSelector(): vscode.LanguageModelChatSelector {
  const { vendor, family } = config();
  const selector: vscode.LanguageModelChatSelector = {};
  if (vendor) selector.vendor = vendor;
  if (family) selector.family = family;
  return selector;
}

class BridgeController {
  private server: http.Server | undefined;
  private starting = false;
  private lastError: string | null = null;
  private readonly statusBarItem: vscode.StatusBarItem;
  private webview: vscode.Webview | undefined;

  constructor(
    private readonly client: CopilotClient,
    private readonly output: vscode.OutputChannel,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'copilotLlmBridge.showLogs';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  attachWebview(webview: vscode.Webview): void {
    this.webview = webview;
    this.postState();
  }

  get running(): boolean {
    return this.server !== undefined;
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${config().port}/v1`;
  }

  private log(line: string): void {
    const stamp = new Date().toISOString().split('T')[1].replace('Z', '');
    this.output.appendLine(`[${stamp}] ${line}`);
  }

  private updateStatusBar(): void {
    if (this.lastError) {
      this.statusBarItem.text = '$(error) Copilot Bridge: Error';
      this.statusBarItem.tooltip = this.lastError;
    } else if (this.starting) {
      this.statusBarItem.text = '$(sync~spin) Copilot Bridge: Starting...';
      this.statusBarItem.tooltip = 'Waiting for model access / consent';
    } else if (this.running) {
      this.statusBarItem.text = `$(radio-tower) Copilot Bridge: ${config().port}`;
      this.statusBarItem.tooltip = `Running -- ${this.baseUrl}`;
    } else {
      this.statusBarItem.text = '$(circle-slash) Copilot Bridge: Stopped';
      this.statusBarItem.tooltip = 'Click "Copilot LLM Bridge: Start" to begin';
    }
  }

  private postState(): void {
    this.updateStatusBar();
    const state: BridgeState = {
      running: this.running,
      starting: this.starting,
      port: config().port,
      baseUrl: this.baseUrl,
      modelName: this.client.selectedModel?.name ?? null,
      error: this.lastError,
    };
    this.webview?.postMessage({ type: 'state', state });
  }

  async start(): Promise<void> {
    if (this.running || this.starting) {
      return;
    }
    this.starting = true;
    this.lastError = null;
    this.postState();

    try {
      // First model access of the session -- must happen inside this
      // user-initiated command so Copilot's consent prompt attaches
      // correctly (see VS Code's Language Model API guide).
      await this.client.ensureModel(modelSelector());

      const { port, sharedSecret } = config();
      this.server = startServer({
        port,
        sharedSecret,
        modelSelector: modelSelector(),
        client: this.client,
        log: (line) => this.log(line),
      });
      this.log(`Started -- base URL ${this.baseUrl}`);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.log(`Failed to start: ${this.lastError}`);
      vscode.window.showErrorMessage(`Copilot LLM Bridge: ${this.lastError}`);
    } finally {
      this.starting = false;
      this.postState();
    }
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
    this.log('Stopped');
    this.postState();
  }

  async selectModel(): Promise<void> {
    const models = await this.client.listModels({});
    if (models.length === 0) {
      vscode.window.showWarningMessage(
        'No Copilot chat models available. Make sure GitHub Copilot is signed in and active.',
      );
      return;
    }
    const picked = await vscode.window.showQuickPick(
      models.map((m) => ({ label: m.name, description: `${m.vendor} / ${m.family}`, model: m })),
      { placeHolder: 'Select the Copilot model the bridge should use' },
    );
    if (picked) {
      this.client.setModel(picked.model);
      this.log(`Model selected: ${picked.model.name} (${picked.model.id})`);
      this.postState();
    }
  }

  async copyBaseUrl(): Promise<void> {
    await vscode.env.clipboard.writeText(this.baseUrl);
    vscode.window.showInformationMessage(`Copied ${this.baseUrl} to clipboard`);
  }

  dispose(): void {
    this.statusBarItem.dispose();
    void this.stop();
  }
}

class BridgeViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: BridgeController,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: { type: string }) => {
      switch (message.type) {
        case 'ready':
          this.controller.attachWebview(webviewView.webview);
          break;
        case 'start':
          void vscode.commands.executeCommand('copilotLlmBridge.start');
          break;
        case 'stop':
          void vscode.commands.executeCommand('copilotLlmBridge.stop');
          break;
        case 'selectModel':
          void vscode.commands.executeCommand('copilotLlmBridge.selectModel');
          break;
        case 'copyBaseUrl':
          void vscode.commands.executeCommand('copilotLlmBridge.copyBaseUrl');
          break;
        case 'showLogs':
          void vscode.commands.executeCommand('copilotLlmBridge.showLogs');
          break;
      }
    });
  }

  private renderHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'));
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'style.css'),
    );
    const nonce = Math.random().toString(36).slice(2);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Copilot LLM Bridge</title>
</head>
<body>
  <div class="app">
    <div class="status-card">
      <div class="dot" id="dot"></div>
      <div class="status-text">
        <h1 id="status-title">Stopped</h1>
        <p id="status-subtitle">Not serving requests</p>
      </div>
    </div>

    <div class="field">
      <label>Base URL</label>
      <div class="field-row">
        <div class="value-box" id="base-url">http://127.0.0.1:4319/v1</div>
      </div>
    </div>

    <div class="field">
      <label>Model</label>
      <div class="value-box" id="model-name">(not selected yet)</div>
    </div>

    <div class="actions">
      <button class="btn-primary" id="start-btn">Start</button>
      <button class="btn-danger" id="stop-btn" style="display:none">Stop</button>
      <button class="btn-secondary" id="select-model-btn">Select Model...</button>
      <button class="btn-secondary" id="copy-btn">Copy Base URL</button>
      <button class="btn-secondary" id="logs-btn">Logs</button>
    </div>

    <p class="hint">
      Point any OpenAI-SDK-compatible client at the base URL above (e.g.
      <code>OPENAGENTS_OPENAI_BASE_URL</code>). VS Code must stay open for
      requests to be served.
    </p>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Copilot LLM Bridge');
  const client = new CopilotClient((line) => output.appendLine(line));
  const controller = new BridgeController(client, output);

  registerRemoteParticipant(context);

  const viewProvider = new BridgeViewProvider(context.extensionUri, controller);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('copilotLlmBridge.panel', viewProvider),
    vscode.commands.registerCommand('copilotLlmBridge.start', () => controller.start()),
    vscode.commands.registerCommand('copilotLlmBridge.stop', () => controller.stop()),
    vscode.commands.registerCommand('copilotLlmBridge.selectModel', () => controller.selectModel()),
    vscode.commands.registerCommand('copilotLlmBridge.copyBaseUrl', () => controller.copyBaseUrl()),
    vscode.commands.registerCommand('copilotLlmBridge.showLogs', () => output.show()),
    output,
    controller,
  );

  if (config().autoStart) {
    // Deliberately still routed through the same user-initiated command
    // path rather than calling controller.start() directly at activation --
    // autoStart just means "do it automatically", not "skip consent".
    void vscode.commands.executeCommand('copilotLlmBridge.start');
  }
}

export function deactivate(): void {
  // controller.dispose() runs via context.subscriptions.
}
