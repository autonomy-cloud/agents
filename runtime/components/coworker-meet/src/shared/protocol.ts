/**
 * Message shapes exchanged over `webview.postMessage` between the extension
 * host (meetingPanel.ts) and the webview (webview/main.ts). Kept in one
 * place so both sides of the channel stay in sync instead of drifting as
 * two separately-maintained union types.
 */
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'connected' }
  | { type: 'transcript'; from: string; text: string };

export type ExtensionToWebviewMessage =
  | {
      type: 'init';
      livekitUrl: string;
      token: string;
      roomName: string;
      displayName: string;
    }
  | { type: 'sendChatMessage'; text: string };
