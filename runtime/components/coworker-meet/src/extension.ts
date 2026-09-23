import * as vscode from 'vscode';
import { MeetingPanel } from './meetingPanel';
import { EmbeddedServerManager } from './embeddedServer';
import { resolveConnection, SETTINGS_SECTION, API_SECRET_KEY } from './connectionResolver';
import { DEFAULT_ROOM_NAME, DEFAULT_COWORKER_IDENTITY } from './shared/constants';
import { registerAnikaChatSession } from './chatSessionProvider';

export function activate(context: vscode.ExtensionContext) {
  const embeddedServer = new EmbeddedServerManager(context.extensionUri);
  context.subscriptions.push(embeddedServer);

  registerAnikaChatSession(context, embeddedServer);

  // Empty tree so the activity-bar view renders its viewsWelcome buttons
  // (Join Meeting / Set API Secret) instead of a real tree of items.
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('coworkerMeet.panel', {
      getTreeItem: (element: vscode.TreeItem) => element,
      getChildren: () => [],
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('coworkerMeet.openMeeting', async () => {
      const connection = await resolveConnection(context, embeddedServer);
      if (!connection) return;

      const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
      const roomName = config.get<string>('roomName', DEFAULT_ROOM_NAME);
      const coworkerIdentity = config.get<string>('coworkerIdentity', DEFAULT_COWORKER_IDENTITY);
      const displayName =
        config.get<string>('displayName', '') || process.env.USER || process.env.USERNAME || 'You';

      MeetingPanel.createOrShow(context.extensionUri, {
        ...connection,
        roomName,
        displayName,
        coworkerIdentity,
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('coworkerMeet.leaveMeeting', async () => {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }),
  );

  const AUTO_OPEN_CHAT_KEY = 'coworkerMeet.autoOpenChatOnActivate';

  context.subscriptions.push(
    vscode.commands.registerCommand('coworkerMeet.openCoworkerWindow', async () => {
      // There's no supported cross-window API to deep-link straight into a
      // specific registered chat session in the window we're about to
      // open -- that new window gets its own separate extension host. This
      // flag (persisted to disk via globalState, so it survives the new
      // process) is the reliable part we can do: auto-focus the Chat view
      // itself on activation there, same as `workbench.view.chat` would.
      // Picking the "Anika" session is then one click, not zero.
      await context.globalState.update(AUTO_OPEN_CHAT_KEY, true);
      await vscode.commands.executeCommand('workbench.action.newWindow');
    }),
  );

  if (context.globalState.get(AUTO_OPEN_CHAT_KEY)) {
    void context.globalState.update(AUTO_OPEN_CHAT_KEY, false).then(async () => {
      await vscode.commands.executeCommand('workbench.view.chat');
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('coworkerMeet.setApiSecret', async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'LiveKit API secret',
        password: true,
        ignoreFocusOut: true,
      });
      if (value) {
        await context.secrets.store(API_SECRET_KEY, value);
        vscode.window.showInformationMessage('Coworker Meet: API secret stored securely.');
      }
    }),
  );
}

export function deactivate() {}
