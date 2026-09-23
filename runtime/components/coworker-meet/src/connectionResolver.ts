import * as vscode from 'vscode';
import * as fs from 'fs';
import { EmbeddedServerManager, ConnectionInfo } from './embeddedServer';

/**
 * Resolves how `coworkerMeet.openMeeting` reaches a LiveKit room server,
 * branching on `coworkerMeet.mode`:
 *  - "embedded" (default): spawn/reuse the bundled local server.
 *  - "advanced": use the LiveKit URL/API key/secret the user configured.
 *
 * Both branches can fail in ways that need a user-facing prompt rather than
 * a thrown error (missing config, missing binary, server start timeout).
 * On failure this already shows the appropriate message/prompt and returns
 * undefined; callers just bail out when they get undefined back.
 */

export const SETTINGS_SECTION = 'coworkerMeet';
export const API_SECRET_KEY = 'coworkerMeet.apiSecret';

export type ConnectionMode = 'embedded' | 'advanced';

export async function resolveConnection(
  context: vscode.ExtensionContext,
  embeddedServer: EmbeddedServerManager,
): Promise<ConnectionInfo | undefined> {
  const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
  const mode = config.get<ConnectionMode>('mode', 'embedded');

  return mode === 'advanced'
    ? resolveAdvancedConnection(context, config)
    : resolveEmbeddedConnection(embeddedServer);
}

async function resolveAdvancedConnection(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
): Promise<ConnectionInfo | undefined> {
  const livekitUrl = config.get<string>('livekitUrl', '');
  const apiKey = config.get<string>('apiKey', '');
  const apiSecret = (await context.secrets.get(API_SECRET_KEY)) ?? config.get<string>('apiSecret', '');

  if (!livekitUrl || !apiKey || !apiSecret) {
    const choice = await vscode.window.showWarningMessage(
      'Advanced mode needs a LiveKit URL, API key, and API secret before it can join a room.',
      'Configure now',
    );
    if (choice === 'Configure now') {
      await vscode.commands.executeCommand('workbench.action.openSettings', SETTINGS_SECTION);
    }
    return undefined;
  }

  return { livekitUrl, apiKey, apiSecret };
}

async function resolveEmbeddedConnection(
  embeddedServer: EmbeddedServerManager,
): Promise<ConnectionInfo | undefined> {
  const binaryPath = embeddedServer.resolveBinaryPathForDiagnostics();
  if (!fs.existsSync(binaryPath)) {
    const choice = await vscode.window.showErrorMessage(
      `Coworker Meet's embedded server isn't built for this platform yet (expected ${binaryPath}). ` +
        'Run "npm run build:server" (see scripts/build-server.mjs), or switch coworkerMeet.mode to "advanced" and supply your own LiveKit server.',
      'Switch to advanced mode',
    );
    if (choice === 'Switch to advanced mode') {
      await vscode.workspace
        .getConfiguration(SETTINGS_SECTION)
        .update('mode', 'advanced', vscode.ConfigurationTarget.Global);
    }
    return undefined;
  }

  try {
    return await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Coworker Meet: starting embedded meeting server…' },
      () => embeddedServer.ensureRunning(),
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Coworker Meet: failed to start embedded server — ${String(err)}`);
    return undefined;
  }
}
