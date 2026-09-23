import { useCallback, useRef, useState } from "react";

type ChatMessageInput = {
  placeholder: string;
  accentColor: string;
  height: number;
  onSend?: (message: string) => void;
};

export const ChatMessageInput = ({
  placeholder,
  accentColor,
  height,
  onSend,
}: ChatMessageInput) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputHasFocus, setInputHasFocus] = useState(false);

  const handleSend = useCallback(() => {
    if (!onSend) {
      return;
    }
    if (message === "") {
      return;
    }

    onSend(message);
    setMessage("");
  }, [onSend, message]);

  return (
    <div
      className="flex flex-col justify-center border-t border-t-gray-200 dark:border-t-white/[0.06]"
      style={{ height: height }}
    >
      <div
        className={`flex flex-row items-center gap-1.5 rounded-full bg-gray-100/90 dark:bg-surface-2/70 border pl-4 pr-1.5 py-1.5 transition-colors ${
          inputHasFocus ? `border-${accentColor}-700` : "border-gray-200 dark:border-white/10"
        }`}
      >
        <input
          ref={inputRef}
          className="w-full text-sm bg-transparent text-gray-800 dark:text-gray-100 placeholder:text-gray-600 dark:placeholder:text-gray-500 focus:outline-none"
          placeholder={placeholder}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          onFocus={() => {
            setInputHasFocus(true);
          }}
          onBlur={() => {
            setInputHasFocus(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        ></input>
        <button
          disabled={message.length === 0 || !onSend}
          onClick={handleSend}
          className={`text-xs font-medium text-gray-950 bg-${accentColor}-500 hover:bg-${accentColor}-400 px-3.5 py-1.5 rounded-full transition-opacity ${
            message.length > 0
              ? "opacity-100 pointer-events-auto"
              : "opacity-30 pointer-events-none"
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
};
