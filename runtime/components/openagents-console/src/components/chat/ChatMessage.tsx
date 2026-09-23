type ChatMessageProps = {
  message: string;
  accentColor: string;
  name: string;
  isSelf: boolean;
  hideName?: boolean;
};

export const ChatMessage = ({
  name,
  message,
  accentColor,
  isSelf,
  hideName,
}: ChatMessageProps) => {
  return (
    <div
      className={`flex flex-col gap-1 ${hideName ? "pt-1" : "pt-3"} ${isSelf ? "items-end" : "items-start"}`}
    >
      {!hideName && (
        <div className="text-xs font-medium text-gray-500 px-1">
          {isSelf ? "You" : name || "Agent"}
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line ${
          isSelf
            ? "bg-surface-3 text-gray-100 rounded-tr-md"
            : `bg-${accentColor}-950 text-${accentColor}-200 rounded-tl-md`
        }`}
      >
        {message}
      </div>
    </div>
  );
};
