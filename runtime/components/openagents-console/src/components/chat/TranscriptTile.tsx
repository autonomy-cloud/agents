import { TranscriptEntry } from "@/components/chat/TranscriptEntry";
import { ReceivedMessage } from "@livekit/components-react";
import { useEffect, useRef } from "react";

type TranscriptTileProps = {
  messages: ReceivedMessage[];
  accentColor: string;
};

export const TranscriptTile = ({
  messages,
  accentColor,
}: TranscriptTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full px-6 text-center">
        <p className="text-xs text-gray-600 dark:text-gray-500 leading-relaxed">
          Live speech-to-text will appear here once the conversation starts.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-y-auto px-1 w-full h-full">
      <div className="flex flex-col min-h-full justify-end">
        {messages.map((message, index, allMsg) => {
          const isAgent = !(message.from?.isLocal ?? false);
          const hideName =
            index >= 1 && allMsg[index - 1].from === message.from;

          return (
            <TranscriptEntry
              key={message.id ?? index}
              hideName={hideName}
              name={message.from?.name ?? ""}
              message={message.message}
              isAgent={isAgent}
              accentColor={accentColor}
            />
          );
        })}
      </div>
    </div>
  );
};
