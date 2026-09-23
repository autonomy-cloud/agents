import { Button } from "./button/Button";
import { useState } from "react";
import { TokenSource, TokenSourceConfigurable } from "livekit-client";
import { PlaygroundConnectProps } from "@/lib/types";

const fieldClass =
  "w-full text-sm text-gray-100 placeholder:text-gray-500 bg-surface-2/70 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none transition-colors focus:border-white/25 focus:bg-surface-2";

const TokenConnect = ({
  accentColor,
  onConnectClicked,
}: PlaygroundConnectProps) => {
  const [url, setUrl] = useState<string>("");
  const [token, setToken] = useState<string>("");

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-400" htmlFor="lk-url">
          Server URL
        </label>
        <input
          id="lk-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={fieldClass}
          placeholder="wss://your-project.livekit.cloud"
        ></input>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          className="text-xs font-medium text-gray-400"
          htmlFor="lk-token"
        >
          Room token
        </label>
        <textarea
          id="lk-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className={`${fieldClass} font-mono text-xs resize-none`}
          rows={3}
          placeholder="Paste a participant token…"
        ></textarea>
      </div>
      <Button
        accentColor={accentColor}
        className="w-full mt-1 justify-center py-2.5 text-sm font-medium"
        onClick={() => {
          const source = TokenSource.literal({
            serverUrl: url,
            participantToken: token,
          });
          onConnectClicked(source, true);
        }}
      >
        Connect
      </Button>
    </div>
  );
};

const ConsoleMark = ({ accentColor }: { accentColor: string }) => (
  <div
    className={`flex items-center justify-center w-11 h-11 rounded-2xl bg-${accentColor}-950 border border-${accentColor}-800 text-${accentColor}-400 shrink-0`}
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 11v1a7 7 0 0 0 14 0v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 19v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

export const PlaygroundConnect = ({
  accentColor,
  onConnectClicked,
}: PlaygroundConnectProps) => {
  const copy = "Connect to a room with a LiveKit URL and access token.";
  return (
    <div className="flex w-full h-full items-center justify-center px-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.07] bg-surface-1 shadow-elevated overflow-hidden">
        <div className="flex flex-col items-start gap-4 px-8 pt-8 pb-6">
          <ConsoleMark accentColor={accentColor} />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Connect to the console
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">{copy}</p>
          </div>
        </div>
        <div className="flex flex-col px-8 pb-8 pt-2 border-t border-white/[0.06]">
          <TokenConnect
            accentColor={accentColor}
            onConnectClicked={onConnectClicked}
          />
        </div>
      </div>
    </div>
  );
};
