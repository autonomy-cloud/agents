"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatTile } from "@/components/chat/ChatTile";
import { TranscriptTile } from "@/components/chat/TranscriptTile";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { AttributesInspector } from "@/components/config/AttributesInspector";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import {
  EditableNameValueRow,
  NameValueRow,
} from "@/components/config/NameValueRow";
import { DebugPanel } from "@/components/debug";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { useRemoteSession } from "@/hooks/useRemoteSession";
import { useConfig } from "@/hooks/useConfig";
import { useUplinkLatency } from "@/hooks/useUplinkLatency";
import { AttributeItem } from "@/lib/types";
import { PartialMessage } from "@bufbuild/protobuf";
import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  VideoTrack,
  useAgent,
  useParticipantAttributes,
  useSession,
  useSessionMessages,
} from "@livekit/components-react";
import {
  ConnectionState,
  TokenSourceConfigurable,
  TokenSourceFetchOptions,
  Track,
} from "livekit-client";
import { RoomAgentDispatch } from "livekit-server-sdk";
import { QRCodeSVG } from "qrcode.react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import tailwindTheme from "../../lib/tailwindTheme.preval";
import { RpcPanel } from "./RpcPanel";

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center w-full h-full px-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] text-gray-500">
        {icon}
      </div>
      <div className="flex flex-col gap-1 max-w-[280px]">
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function VideoOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8.5v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
      <path d="m21 7-5 4 5 4V7Z" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function WorkstationOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="4.5" width="19" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16.5V20" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function AudioOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-1" />
      <path d="M19 11v1a7 7 0 0 1-.11 1.23" />
      <path d="M12 19v3" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

export interface PlaygroundMeta {
  name: string;
  value: string;
}

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  tokenSource: TokenSourceConfigurable;
  agentOptions?: PartialMessage<RoomAgentDispatch>;
  autoConnect?: boolean;
}

const headerHeight = 56;

function generateRandomRoomName() {
  return `room-${Math.random().toString(36).substring(2, 10)}`;
}

export default function Playground({
  logo,
  themeColors,
  tokenSource,
  agentOptions: initialAgentOptions,
  autoConnect,
}: PlaygroundProps) {
  const { config, setUserSettings } = useConfig();

  const [rpcMethod, setRpcMethod] = useState("");
  const [rpcPayload, setRpcPayload] = useState("");
  const [hasConnected, setHasConnected] = useState(false);

  // User-entered room name. When empty, a random name is generated
  // in tokenFetchOptions for each session.
  const [userRoomName, setUserRoomName] = useState("");

  const [tokenFetchOptions, setTokenFetchOptions] =
    useState<TokenSourceFetchOptions>(() => {
      // Always initialize with a roomName so the SDK's token cache
      // has a non-empty key set for future equality comparisons.
      const opts: TokenSourceFetchOptions = {
        roomName: generateRandomRoomName(),
      };
      if (initialAgentOptions) {
        opts.agentName = initialAgentOptions.agentName ?? "";
        opts.agentMetadata = initialAgentOptions.metadata ?? "";
      }
      return opts;
    });

  // Store attributes as an array with stable IDs to prevent disappearing while editing
  // Initialize with one empty attribute so the inspector isn't empty on first open
  const [attributeItems, setAttributeItems] = useState<AttributeItem[]>([
    { id: `attr_initial_${Date.now()}`, key: "", value: "" },
  ]);

  const session = useSession(tokenSource, tokenFetchOptions);
  const { connectionState } = session;
  const agent = useAgent(session);
  const messages = useSessionMessages(session);

  const {
    events: clientEvents,
    overlappingSpeechEvents,
    sessionUsage,
    networkLatency,
    clearEvents,
    sendRequest,
  } = useRemoteSession(session.room);

  const uplinkLatency = useUplinkLatency(
    session.room,
    agent.internal.agentParticipant?.identity,
    sendRequest,
  );

  const localScreenTrack = session.room.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );

  // The coworker's own desktop, published as a screen-share track by
  // openagents-workstation under the agent's participant identity —
  // rendered as its own panel, distinct from the agent's camera feed.
  const agentWorkstationTrack = agent.internal.agentParticipant
    ? agent.internal.agentParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )
    : undefined;

  const startSession = useCallback(() => {
    if (session.isConnected) {
      return;
    }
    session.start();
    setHasConnected(true);
  }, [session]);

  useEffect(() => {
    if (autoConnect && !hasConnected) {
      startSession();
    }
  }, [autoConnect, hasConnected, startSession]);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      session.room.localParticipant.setCameraEnabled(
        config.settings.inputs.camera,
      );
      session.room.localParticipant.setMicrophoneEnabled(
        config.settings.inputs.mic,
      );
    }
  }, [
    config.settings.inputs.camera,
    config.settings.inputs.mic,
    session.room.localParticipant,
    connectionState,
  ]);

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      clearEvents();
    }
  }, [connectionState, clearEvents]);

  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      setShowDebugPanel(false);
    } else if (!showDebugPanel && clientEvents.length > 0) {
      setShowDebugPanel(true);
    }
  }, [connectionState, showDebugPanel, clientEvents.length]);

  const videoTileContent = useMemo(() => {
    const videoFitClassName = `object-${config.video_fit || "contain"}`;

    const disconnectedContent = (
      <EmptyState
        icon={<VideoOffIcon />}
        title="No video track"
        description="Connect to a room to see the agent's video."
      />
    );

    const loadingContent = (
      <EmptyState
        icon={<LoadingSVG />}
        title="Waiting for video"
        description="The agent's video track will appear here once available."
      />
    );

    const videoContent = agent.cameraTrack ? (
      <VideoTrack
        trackRef={agent.cameraTrack}
        className={`absolute top-1/2 -translate-y-1/2 ${videoFitClassName} object-position-center w-full h-full`}
      />
    ) : null;

    let content = null;
    if (connectionState === ConnectionState.Disconnected) {
      content = disconnectedContent;
    } else if (agent.cameraTrack) {
      content = videoContent;
    } else {
      content = loadingContent;
    }

    return (
      <div className="flex flex-col w-full grow bg-surface-0 rounded-xl overflow-hidden relative">
        {content}
      </div>
    );
  }, [agent.cameraTrack, config, connectionState]);

  const workstationTileContent = useMemo(() => {
    const disconnectedContent = (
      <EmptyState
        icon={<WorkstationOffIcon />}
        title="No workstation shared"
        description="Connect to a room to see the agent's desktop."
      />
    );

    const waitingContent = (
      <EmptyState
        icon={<LoadingSVG />}
        title="Waiting for workstation"
        description="The agent's desktop will appear here once it shares its screen."
      />
    );

    if (connectionState === ConnectionState.Disconnected) {
      return (
        <div className="flex flex-col w-full grow bg-surface-0 rounded-xl overflow-hidden relative">
          {disconnectedContent}
        </div>
      );
    }

    if (!agentWorkstationTrack || !agent.internal.agentParticipant) {
      return (
        <div className="flex flex-col w-full grow bg-surface-0 rounded-xl overflow-hidden relative">
          {waitingContent}
        </div>
      );
    }

    return (
      <div className="flex flex-col w-full grow bg-surface-0 rounded-xl overflow-hidden relative">
        <VideoTrack
          trackRef={{
            participant: agent.internal.agentParticipant,
            publication: agentWorkstationTrack,
            source: Track.Source.ScreenShare,
          }}
          className="absolute top-1/2 -translate-y-1/2 object-contain object-position-center w-full h-full"
        />
      </div>
    );
  }, [agentWorkstationTrack, agent.internal.agentParticipant, connectionState]);

  useEffect(() => {
    document.body.style.setProperty(
      "--lk-theme-color",
      // @ts-ignore
      tailwindTheme.colors[config.settings.theme_color]["500"],
    );
    document.body.style.setProperty(
      "--lk-drop-shadow",
      `var(--lk-theme-color) 0px 0px 18px`,
    );
  }, [config.settings.theme_color]);

  const audioTileContent = useMemo(() => {
    const disconnectedContent = (
      <EmptyState
        icon={<AudioOffIcon />}
        title="No audio track"
        description="Connect to a room to hear the agent's audio."
      />
    );

    const waitingContent = (
      <EmptyState
        icon={<LoadingSVG />}
        title="Waiting for audio"
        description="The agent's audio track will appear here once available."
      />
    );

    const visualizerContent = (
      <div
        className={`flex items-center justify-center w-full h-48 [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}
      >
        <BarVisualizer
          state={agent.state}
          track={agent.microphoneTrack}
          barCount={5}
          options={{ minHeight: 20 }}
        />
      </div>
    );

    if (connectionState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    if (!agent.microphoneTrack) {
      return waitingContent;
    }

    return visualizerContent;
  }, [agent.microphoneTrack, connectionState, agent.state]);

  // Typed chat and live speech-to-text share one underlying message
  // stream (ReceivedMessage is a union of chat + user/agent transcript
  // types); split them so Chat stays typed-text-only and Transcript
  // shows only what was actually spoken.
  const chatOnlyMessages = useMemo(
    () =>
      messages.messages.filter(
        (m) => !m.type || m.type === "chatMessage",
      ),
    [messages.messages],
  );

  const transcriptMessages = useMemo(
    () =>
      messages.messages.filter(
        (m) => m.type === "userTranscript" || m.type === "agentTranscript",
      ),
    [messages.messages],
  );

  const chatTileContent = useMemo(() => {
    if (agent.isConnected) {
      return (
        <ChatTile
          messages={chatOnlyMessages}
          accentColor={config.settings.theme_color}
          onSend={messages.send}
        />
      );
    }
    return <></>;
  }, [agent.isConnected, config.settings.theme_color, chatOnlyMessages, messages.send]);

  const transcriptTileContent = useMemo(() => {
    return (
      <TranscriptTile
        messages={transcriptMessages}
        accentColor={config.settings.theme_color}
      />
    );
  }, [transcriptMessages, config.settings.theme_color]);

  const handleRpcCall = useCallback(async () => {
    if (!agent.internal.agentParticipant) {
      throw new Error("No agent or room available");
    }

    const response = await session.room.localParticipant.performRpc({
      destinationIdentity: agent.internal.agentParticipant.identity,
      method: rpcMethod,
      payload: rpcPayload,
    });
    return response;
  }, [
    session.room.localParticipant,
    rpcMethod,
    rpcPayload,
    agent.internal.agentParticipant,
  ]);

  const handleAttributesChange = useCallback(
    (newAttributes: AttributeItem[]) => {
      // Store the full array with stable IDs to preserve attributes during editing
      setAttributeItems(newAttributes);

      // Convert to map for tokenFetchOptions, but only include non-empty keys
      // Duplicates are handled by keeping the last occurrence (later values overwrite earlier ones)
      const newAttributesMap = newAttributes.reduce(
        (acc, attr) => {
          if (attr.key && attr.key.trim() !== "") {
            acc[attr.key] = attr.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      setTokenFetchOptions((prev) => ({
        ...prev,
        participantAttributes: newAttributesMap,
      }));
    },
    [],
  );

  const agentAttributes = useParticipantAttributes({
    participant: agent.internal.agentParticipant ?? undefined,
  });

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col h-full w-full items-start overflow-y-auto">
        {config.description && (
          <ConfigurationPanelItem title="Description">
            {config.description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="Room">
          <div className="flex flex-col gap-2">
            <EditableNameValueRow
              name="Room name"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.name
                  : userRoomName
              }
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setUserRoomName(value);
                setTokenFetchOptions((prev) => ({
                  ...prev,
                  roomName: value || generateRandomRoomName(),
                }));
              }}
              placeholder="Auto"
              editable={connectionState !== ConnectionState.Connected}
            />
            <NameValueRow
              name="Status"
              value={
                connectionState === ConnectionState.Connecting ? (
                  <LoadingSVG diameter={16} strokeWidth={2} />
                ) : (
                  connectionState.charAt(0).toUpperCase() +
                  connectionState.slice(1)
                )
              }
              valueColor={
                connectionState === ConnectionState.Connected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
          </div>
        </ConfigurationPanelItem>

        <ConfigurationPanelItem title="Agent">
          <div className="flex flex-col gap-2">
            <EditableNameValueRow
              name="Agent name"
              value={tokenFetchOptions?.agentName ?? ""}
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  agentName: value,
                });
              }}
              placeholder="None"
              editable={connectionState !== ConnectionState.Connected}
            />
            <NameValueRow
              name="Identity"
              value={
                agent.internal.agentParticipant ? (
                  agent.internal.agentParticipant.identity
                ) : connectionState === ConnectionState.Connected ? (
                  <LoadingSVG diameter={12} strokeWidth={2} />
                ) : (
                  "No agent connected"
                )
              }
              valueColor={
                agent.isConnected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
            {connectionState === ConnectionState.Connected &&
              agent.internal.agentParticipant && (
                <AttributesInspector
                  attributes={Object.entries(
                    agentAttributes.attributes || {},
                  ).map(([key, value]) => ({
                    id: key,
                    key,
                    value: String(value),
                  }))}
                  onAttributesChange={() => {}}
                  themeColor={config.settings.theme_color}
                  disabled={true}
                />
              )}
            <p className="text-xs text-gray-500 text-right">
              Set an agent name to use{" "}
              <a
                href="https://docs.livekit.io/agents/server/agent-dispatch/#explicit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 underline"
              >
                explicit dispatch
              </a>
              .
            </p>
          </div>
        </ConfigurationPanelItem>

        <ConfigurationPanelItem title="User">
          <div className="flex flex-col gap-2">
            <EditableNameValueRow
              name="Name"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.localParticipant.name || ""
                  : (tokenFetchOptions?.participantName ?? "")
              }
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantName: value,
                });
              }}
              placeholder="Auto"
              editable={connectionState !== ConnectionState.Connected}
            />
            <EditableNameValueRow
              name="Identity"
              value={
                connectionState === ConnectionState.Connected
                  ? session.room.localParticipant.identity
                  : (tokenFetchOptions?.participantIdentity ?? "")
              }
              valueColor={`${config.settings.theme_color}-500`}
              onValueChange={(value) => {
                setTokenFetchOptions({
                  ...tokenFetchOptions,
                  participantIdentity: value,
                });
              }}
              placeholder="Auto"
              editable={connectionState !== ConnectionState.Connected}
            />
            <AttributesInspector
              attributes={attributeItems}
              onAttributesChange={handleAttributesChange}
              metadata={tokenFetchOptions?.participantMetadata}
              onMetadataChange={(metadata) => {
                setTokenFetchOptions((prev) => ({
                  ...prev,
                  participantMetadata: metadata,
                }));
              }}
              themeColor={config.settings.theme_color}
              disabled={false}
              connectionState={connectionState}
            />
          </div>
        </ConfigurationPanelItem>

        {connectionState === ConnectionState.Connected &&
          config.settings.inputs.screen && (
            <ConfigurationPanelItem
              title="Screen"
              source={Track.Source.ScreenShare}
            >
              {localScreenTrack ? (
                <div className="relative">
                  <VideoTrack
                    className="rounded-xl border border-white/10 opacity-80 w-full"
                    trackRef={
                      localScreenTrack
                        ? {
                            participant: session.room.localParticipant,
                            publication: localScreenTrack,
                            source: Track.Source.ScreenShare,
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center text-gray-500 text-center text-xs w-full py-4">
                  Press the button above to share your screen.
                </div>
              )}
            </ConfigurationPanelItem>
          )}
        {connectionState === ConnectionState.Connected && agent.isConnected && (
          <RpcPanel
            config={config}
            rpcMethod={rpcMethod}
            rpcPayload={rpcPayload}
            setRpcMethod={setRpcMethod}
            setRpcPayload={setRpcPayload}
            handleRpcCall={handleRpcCall}
          />
        )}
        {config.settings.inputs.camera && (
          <ConfigurationPanelItem title="Camera" source={Track.Source.Camera}>
            {session.local.cameraTrack ? (
              <div className="relative">
                <VideoTrack
                  className="rounded-xl border border-white/10 opacity-80 w-full"
                  trackRef={session.local.cameraTrack}
                />
              </div>
            ) : null}
          </ConfigurationPanelItem>
        )}
        {config.settings.inputs.mic && (
          <ConfigurationPanelItem
            title="Microphone"
            source={Track.Source.Microphone}
          >
            {session.local.microphoneTrack ? (
              <AudioInputTile trackRef={session.local.microphoneTrack} />
            ) : null}
          </ConfigurationPanelItem>
        )}
        <div className="w-full">
          <ConfigurationPanelItem title="Color">
            <ColorPicker
              colors={themeColors}
              selectedColor={config.settings.theme_color}
              onSelect={(color) => {
                const userSettings = { ...config.settings };
                userSettings.theme_color = color;
                setUserSettings(userSettings);
              }}
            />
          </ConfigurationPanelItem>
        </div>
        {config.show_qr && (
          <div className="w-full">
            <ConfigurationPanelItem title="QR Code">
              <QRCodeSVG value={window.location.href} width="128" />
            </ConfigurationPanelItem>
          </div>
        )}
      </div>
    );
  }, [
    config,
    agent.isConnected,
    agentAttributes.attributes,
    session.room.localParticipant,
    session.room.name,
    connectionState,
    session.local.cameraTrack,
    localScreenTrack,
    session.local.microphoneTrack,
    themeColors,
    setUserSettings,
    agent.internal.agentParticipant,
    rpcMethod,
    rpcPayload,
    handleRpcCall,
    handleAttributesChange,
    attributeItems,
    tokenFetchOptions,
    setTokenFetchOptions,
    userRoomName,
  ]);

  let mobileTabs: PlaygroundTab[] = [];
  if (config.settings.outputs.video) {
    mobileTabs.push({
      title: "Video",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {videoTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.outputs.audio) {
    mobileTabs.push({
      title: "Audio",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {audioTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.outputs.workstation) {
    mobileTabs.push({
      title: "Workstation",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {workstationTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.chat) {
    mobileTabs.push({
      title: "Chat",
      content: chatTileContent,
    });
    mobileTabs.push({
      title: "Transcript",
      content: transcriptTileContent,
    });
  }

  mobileTabs.push({
    title: "Settings",
    content: (
      <PlaygroundTile
        padding={false}
        backgroundColor="gray-950"
        className="h-full w-full basis-1/4 items-start overflow-y-auto flex"
        childrenClassName="h-full grow items-start"
      >
        {settingsTileContent}
      </PlaygroundTile>
    ),
  });

  return (
    <SessionProvider session={session}>
      <div className="flex flex-col h-full w-full">
        <PlaygroundHeader
          title={config.title}
          logo={logo}
          githubLink={config.github_link}
          height={headerHeight}
          accentColor={config.settings.theme_color}
          connectionState={connectionState}
          onConnectClicked={() => {
            if (connectionState === ConnectionState.Disconnected) {
              startSession();
            } else if (connectionState === ConnectionState.Connected) {
              session.end();
              // Generate a new random room name for next connect so the
              // SDK fetches a fresh token. User-set names are preserved.
              if (!userRoomName) {
                setTokenFetchOptions((prev) => ({
                  ...prev,
                  roomName: generateRandomRoomName(),
                }));
              }
            }
          }}
        />
        <div
          className={`flex gap-5 py-5 grow w-full overflow-hidden selection:bg-${config.settings.theme_color}-900`}
          style={{ minHeight: 0 }}
        >
          <div className="flex flex-col grow basis-1/2 gap-4 h-full lg:hidden">
            <PlaygroundTabbedTile
              className="h-full"
              tabs={mobileTabs}
              initialTab={mobileTabs.length - 1}
            />
          </div>
          <div
            className={`flex-col grow basis-1/2 gap-4 h-full hidden lg:${
              !config.settings.outputs.audio &&
              !config.settings.outputs.video &&
              !config.settings.outputs.workstation
                ? "hidden"
                : "flex"
            }`}
          >
            {config.settings.outputs.video && (
              <PlaygroundTile
                title="Agent video"
                className="w-full h-full grow"
                childrenClassName="justify-center"
              >
                {videoTileContent}
              </PlaygroundTile>
            )}
            {config.settings.outputs.workstation && (
              <PlaygroundTile
                title="Workstation"
                className="w-full h-full grow"
                childrenClassName="justify-center"
              >
                {workstationTileContent}
              </PlaygroundTile>
            )}
            {config.settings.outputs.audio && (
              <PlaygroundTile
                title="Agent audio"
                className="w-full h-full grow"
                childrenClassName="justify-center"
              >
                {audioTileContent}
              </PlaygroundTile>
            )}
          </div>

          {config.settings.chat && (
            <div className="flex-col grow basis-1/4 gap-4 h-full hidden lg:flex">
              <PlaygroundTile title="Chat" className="w-full h-full grow">
                {chatTileContent}
              </PlaygroundTile>
              <PlaygroundTile
                title="Transcript"
                className="w-full h-full grow"
              >
                {transcriptTileContent}
              </PlaygroundTile>
            </div>
          )}
          <PlaygroundTile
            padding={false}
            backgroundColor="gray-950"
            className="h-full w-full basis-1/4 items-start overflow-y-auto hidden max-w-[420px] lg:flex"
            childrenClassName="h-full grow items-start"
          >
            {settingsTileContent}
          </PlaygroundTile>
        </div>
        {showDebugPanel && (
          <DebugPanel
            userTrack={session.local.microphoneTrack?.publication?.track}
            agentTrack={agent.microphoneTrack?.publication?.track}
            events={clientEvents}
            overlappingSpeechEvents={overlappingSpeechEvents}
            sessionUsage={sessionUsage}
            onClearEvents={clearEvents}
            networkLatency={networkLatency}
            uplinkLatency={uplinkLatency}
          />
        )}
        <RoomAudioRenderer />
        <StartAudio label="Click to enable audio playback" />
      </div>
    </SessionProvider>
  );
}
