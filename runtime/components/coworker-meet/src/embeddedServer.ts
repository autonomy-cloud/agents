import * as vscode from 'vscode';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

/**
 * Zero-config default: an OpenAgents/LiveKit room server (built from
 * autonomy-cloud/agents' vendored `openagents-server`) bundled with this
 * extension and run locally via `--dev` mode, which self-assigns the
 * well-known dev credentials (devkey/secret) and needs no account, no
 * cloud project, and no manually entered API key.
 *
 * "Advanced" mode bypasses all of this and connects to whatever LiveKit
 * deployment the user configures explicitly in settings instead.
 */
export interface ConnectionInfo {
  livekitUrl: string;
  apiKey: string;
  apiSecret: string;
}

const DEV_API_KEY = 'devkey';
const DEV_API_SECRET = 'secret';
const DEV_PORT = 7880;
const SERVER_START_TIMEOUT_MS = 15_000;
const PORT_POLL_INTERVAL_MS = 250;
const PORT_CHECK_TIMEOUT_MS = 500;

export class EmbeddedServerManager implements vscode.Disposable {
  private process: ChildProcess | undefined;
  private readyPromise: Promise<ConnectionInfo> | undefined;
  private readonly output: vscode.OutputChannel;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.output = vscode.window.createOutputChannel('Coworker Meet: Embedded Server');
  }

  async ensureRunning(): Promise<ConnectionInfo> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (await isPortOpen(DEV_PORT)) {
        this.output.appendLine(`Reusing already-running server on :${DEV_PORT}.`);
        return this.connectionInfo();
      }

      const binaryPath = this.resolveBinaryPath();
      this.output.appendLine(`Starting embedded server: ${binaryPath} --dev`);

      // --node-ip pins the RTC node identity to loopback: on multi-homed
      // machines (VPN/Tailscale/LAN interfaces all up at once) dev mode
      // otherwise advertises a LAN address the webview can't always reach.
      this.process = spawn(binaryPath, ['--dev', '--node-ip=127.0.0.1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.process.stdout?.on('data', (chunk) => this.output.append(chunk.toString()));
      this.process.stderr?.on('data', (chunk) => this.output.append(chunk.toString()));
      this.process.on('exit', (code) => {
        this.output.appendLine(`Embedded server exited with code ${code}.`);
        this.process = undefined;
        this.readyPromise = undefined;
      });

      await waitForPort(DEV_PORT, SERVER_START_TIMEOUT_MS);
      return this.connectionInfo();
    })();

    return this.readyPromise;
  }

  private connectionInfo(): ConnectionInfo {
    return {
      livekitUrl: `ws://127.0.0.1:${DEV_PORT}`,
      apiKey: DEV_API_KEY,
      apiSecret: DEV_API_SECRET,
    };
  }

  /** Public so callers can show a helpful error before even attempting to spawn. */
  resolveBinaryPathForDiagnostics(): string {
    return this.resolveBinaryPath();
  }

  private resolveBinaryPath(): string {
    const platformArch = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'openagents-server.exe' : 'openagents-server';
    const binaryPath = path.join(this.extensionUri.fsPath, 'bin', platformArch, binaryName);
    return binaryPath;
  }

  dispose() {
    this.process?.kill();
    this.process = undefined;
    this.output.dispose();
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: PORT_CHECK_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, PORT_POLL_INTERVAL_MS));
  }
  throw new Error(`Embedded server did not become ready on port ${port} within ${timeoutMs}ms.`);
}
