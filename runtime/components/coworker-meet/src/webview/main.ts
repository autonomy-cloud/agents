import './style.css';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  ConnectionState,
} from 'livekit-client';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/protocol';
import { DEFAULT_COWORKER_IDENTITY } from '../shared/constants';

declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewToExtensionMessage) => void;
};

const vscode = acquireVsCodeApi();

// LiveKit text-stream topics openagents-core's room_io actually listens on
// (and publishes replies over) -- see openagents/agents/types.py. A raw
// data-channel publishData/DataReceived message, which is what this file
// used before, is invisible to the agent: room_io only registers a text
// stream handler for TOPIC_CHAT, nothing generic.
const TOPIC_CHAT = 'lk.chat';
const TOPIC_TRANSCRIPTION = 'lk.transcription';

const app = document.getElementById('app') as HTMLDivElement;
const grid = document.getElementById('grid') as HTMLDivElement;
const chatLog = document.getElementById('chatLog') as HTMLDivElement;
const chatForm = document.getElementById('chatForm') as HTMLFormElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const statusDot = document.getElementById('statusDot') as HTMLSpanElement;
const statusLabel = document.getElementById('statusLabel') as HTMLSpanElement;
const toggleMicBtn = document.getElementById('toggleMicBtn') as HTMLButtonElement;
const toggleCamBtn = document.getElementById('toggleCamBtn') as HTMLButtonElement;

const coworkerIdentityPrefix = app.dataset.coworker ?? DEFAULT_COWORKER_IDENTITY;

const room = new Room({ adaptiveStream: true, dynacast: true });
let displayName = 'You';
let micEnabled = true;
let camEnabled = false;

function setStatus(text: string, live: boolean) {
  statusLabel.textContent = text;
  statusDot.classList.toggle('dot--live', live);
  statusDot.classList.toggle('dot--pending', !live);
}

function isCoworkerIdentity(identity: string): boolean {
  return identity.startsWith(coworkerIdentityPrefix);
}

function ensureTile(identity: string, name: string, isLocal: boolean): HTMLDivElement {
  let tile = document.getElementById(`tile-${identity}`) as HTMLDivElement | null;
  if (tile) return tile;

  tile = document.createElement('div');
  tile.id = `tile-${identity}`;
  tile.className = 'tile' + (isCoworkerIdentity(identity) ? ' tile--coworker' : '');

  const media = document.createElement('div');
  media.className = 'tile__media';

  const initials = document.createElement('div');
  initials.className = 'tile__avatar';
  initials.textContent = (isCoworkerIdentity(identity) ? 'AI' : name || identity).slice(0, 2).toUpperCase();
  media.appendChild(initials);

  const label = document.createElement('div');
  label.className = 'tile__label';
  label.innerHTML = `<span>${escapeHtml(name || identity)}${isLocal ? ' (you)' : ''}</span>`;
  if (isCoworkerIdentity(identity)) {
    const badge = document.createElement('span');
    badge.className = 'badge badge--coworker';
    badge.textContent = 'AI coworker';
    label.appendChild(badge);
  }

  tile.appendChild(media);
  tile.appendChild(label);
  grid.appendChild(tile);
  return tile;
}

function removeTile(identity: string) {
  document.getElementById(`tile-${identity}`)?.remove();
}

/** Replaces a tile's avatar placeholder with the given track's rendered video element. */
function renderVideoIntoTile(tile: HTMLDivElement, track: { attach(): HTMLMediaElement }) {
  const media = tile.querySelector('.tile__media') as HTMLDivElement;
  media.querySelector('.tile__avatar')?.remove();
  const el = track.attach();
  el.className = 'tile__video';
  media.innerHTML = '';
  media.appendChild(el);
}

function attachTrack(pub: RemoteTrackPublication, participant: RemoteParticipant) {
  if (!pub.track || pub.kind !== Track.Kind.Video) return;
  const tile = ensureTile(participant.identity, participant.name ?? participant.identity, false);
  renderVideoIntoTile(tile, pub.track);
}

function appendChatMessage(from: string, text: string, isCoworker: boolean, isSelf: boolean) {
  const row = document.createElement('div');
  row.className = 'chat-msg' + (isSelf ? ' chat-msg--self' : '') + (isCoworker ? ' chat-msg--coworker' : '');
  row.innerHTML = `<span class="chat-msg__from">${escapeHtml(from)}</span><span class="chat-msg__text">${escapeHtml(text)}</span>`;
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Sends a chat message over the topic room_io's text-input handler listens
 * on, so a dispatched agent actually sees it and calls generate_reply(). */
function sendChatText(text: string) {
  void room.localParticipant.sendText(text, { topic: TOPIC_CHAT });
}

room
  .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    if (state === ConnectionState.Connected) setStatus('Live', true);
    else if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) setStatus('Connecting…', false);
    else setStatus('Disconnected', false);
  })
  .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
    ensureTile(p.identity, p.name ?? p.identity, false);
  })
  .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
    removeTile(p.identity);
  })
  .on(RoomEvent.TrackSubscribed, (_track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    attachTrack(pub, participant);
  });

// Other humans' chat messages, echoed back over the same topic.
room.registerTextStreamHandler(TOPIC_CHAT, async (reader, participantInfo) => {
  if (participantInfo.identity === room.localParticipant.identity) return; // we already show our own on submit
  const text = await reader.readAll();
  appendChatMessage(participantInfo.identity, text, isCoworkerIdentity(participantInfo.identity), false);
});

// The dispatched agent's spoken/generated reply, published over TOPIC_TRANSCRIPTION.
room.registerTextStreamHandler(TOPIC_TRANSCRIPTION, async (reader, participantInfo) => {
  const text = await reader.readAll();
  appendChatMessage(participantInfo.identity, text, isCoworkerIdentity(participantInfo.identity), false);
  vscode.postMessage({ type: 'transcript', from: participantInfo.identity, text });
});

window.addEventListener('message', async (event: MessageEvent<ExtensionToWebviewMessage>) => {
  const message = event.data;
  if (message.type === 'init') {
    displayName = message.displayName;
    (document.getElementById('roomTitle') as HTMLElement).textContent = message.roomName;
    try {
      await room.connect(message.livekitUrl, message.token);
      ensureTile(room.localParticipant.identity, displayName, true);
      await room.localParticipant.setMicrophoneEnabled(true);
      vscode.postMessage({ type: 'connected' });
    } catch (err) {
      setStatus('Connection failed', false);
      vscode.postMessage({ type: 'error', message: String(err) });
    }
  } else if (message.type === 'sendChatMessage') {
    // A chat-session provider (see chatSessionProvider.ts) relaying a
    // message from VS Code's own chat UI into this room, on the local
    // participant's behalf -- shown locally the same way a typed message is.
    appendChatMessage(displayName, message.text, false, true);
    sendChatText(message.text);
  }
});

// Chat goes over the same LiveKit text-stream topic (TOPIC_CHAT) room_io's
// text-input handler listens on, so a dispatched agent actually sees it and
// calls generate_reply() -- not a raw data-channel message only other
// humans in the room would notice.
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  appendChatMessage(displayName, text, false, true);
  sendChatText(text);
});

toggleMicBtn.addEventListener('click', async () => {
  micEnabled = !micEnabled;
  await room.localParticipant.setMicrophoneEnabled(micEnabled);
  toggleMicBtn.classList.toggle('icon-btn--off', !micEnabled);
  toggleMicBtn.setAttribute('aria-pressed', String(micEnabled));
});

toggleCamBtn.addEventListener('click', async () => {
  camEnabled = !camEnabled;
  await room.localParticipant.setCameraEnabled(camEnabled);
  toggleCamBtn.classList.toggle('icon-btn--off', !camEnabled);
  toggleCamBtn.setAttribute('aria-pressed', String(camEnabled));

  if (camEnabled) {
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.track) {
      const tile = ensureTile(room.localParticipant.identity, displayName, true);
      renderVideoIntoTile(tile, pub.track);
    }
  }
});

setStatus('Connecting…', false);
vscode.postMessage({ type: 'ready' });
