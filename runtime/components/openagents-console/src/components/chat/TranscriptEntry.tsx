type TranscriptEntryProps = {
  name: string;
  message: string;
  accentColor: string;
  isAgent: boolean;
  hideName?: boolean;
};

export const TranscriptEntry = ({
  name,
  message,
  accentColor,
  isAgent,
  hideName,
}: TranscriptEntryProps) => {
  return (
    <div className={`flex flex-col gap-0.5 ${hideName ? "pt-1" : "pt-3"}`}>
      {!hideName && (
        <div
          className={`text-xs font-medium px-1 ${
            isAgent ? `text-${accentColor}-400` : "text-gray-400"
          }`}
        >
          {name || (isAgent ? "Agent" : "You")}
        </div>
      )}
      <p className="text-sm leading-relaxed text-gray-300 px-1 whitespace-pre-line">
        {message}
      </p>
    </div>
  );
};
