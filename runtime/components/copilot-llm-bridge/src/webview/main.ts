interface VsCodeApi {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

interface BridgeState {
  running: boolean;
  starting: boolean;
  port: number;
  baseUrl: string;
  modelName: string | null;
  error: string | null;
}

const vscode = acquireVsCodeApi();

const dot = document.getElementById('dot') as HTMLDivElement;
const statusTitle = document.getElementById('status-title') as HTMLHeadingElement;
const statusSubtitle = document.getElementById('status-subtitle') as HTMLParagraphElement;
const baseUrlBox = document.getElementById('base-url') as HTMLDivElement;
const modelBox = document.getElementById('model-name') as HTMLDivElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const selectModelBtn = document.getElementById('select-model-btn') as HTMLButtonElement;
const logsBtn = document.getElementById('logs-btn') as HTMLButtonElement;

function render(state: BridgeState): void {
  dot.className = 'dot' + (state.error ? ' dot--error' : state.running ? ' dot--live' : '');

  if (state.error) {
    statusTitle.textContent = 'Error';
    statusSubtitle.textContent = state.error;
  } else if (state.starting) {
    statusTitle.textContent = 'Starting...';
    statusSubtitle.textContent = 'Waiting for model access / consent';
  } else if (state.running) {
    statusTitle.textContent = 'Running';
    statusSubtitle.textContent = `Listening on port ${state.port}`;
  } else {
    statusTitle.textContent = 'Stopped';
    statusSubtitle.textContent = 'Not serving requests';
  }

  baseUrlBox.textContent = state.baseUrl;
  modelBox.textContent = state.modelName ?? '(not selected yet)';

  startBtn.style.display = state.running || state.starting ? 'none' : '';
  stopBtn.style.display = state.running || state.starting ? '' : 'none';
}

startBtn.addEventListener('click', () => vscode.postMessage({ type: 'start' }));
stopBtn.addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
copyBtn.addEventListener('click', () => vscode.postMessage({ type: 'copyBaseUrl' }));
selectModelBtn.addEventListener('click', () => vscode.postMessage({ type: 'selectModel' }));
logsBtn.addEventListener('click', () => vscode.postMessage({ type: 'showLogs' }));

window.addEventListener('message', (event) => {
  const message = event.data as { type: string; state?: BridgeState };
  if (message.type === 'state' && message.state) {
    render(message.state);
  }
});

vscode.postMessage({ type: 'ready' });
