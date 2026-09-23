import { ReactNode, useState } from "react";

const titleHeight = 44;

type PlaygroundTileProps = {
  title?: string;
  children?: ReactNode;
  className?: string;
  childrenClassName?: string;
  padding?: boolean;
  backgroundColor?: string;
};

export type PlaygroundTab = {
  title: string;
  content: ReactNode;
};

export type PlaygroundTabbedTileProps = {
  tabs: PlaygroundTab[];
  initialTab?: number;
} & PlaygroundTileProps;

export const PlaygroundTile: React.FC<PlaygroundTileProps> = ({
  children,
  title,
  className,
  childrenClassName,
  padding = true,
  backgroundColor,
}) => {
  const contentPadding = padding ? 4 : 0;
  const surfaceClass = backgroundColor
    ? `bg-${backgroundColor}`
    : "bg-surface-1";
  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/[0.06] shadow-card text-gray-400 ${surfaceClass} ${className}`}
    >
      {title && (
        <div
          className="flex items-center px-4 text-sm font-medium text-gray-300 border-b border-b-white/[0.06] shrink-0"
          style={{
            height: `${titleHeight}px`,
          }}
        >
          <h2>{title}</h2>
        </div>
      )}
      <div
        className={`flex flex-col items-center grow w-full ${childrenClassName}`}
        style={{
          height: `calc(100% - ${title ? titleHeight + "px" : "0px"})`,
          padding: `${contentPadding * 4}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const PlaygroundTabbedTile: React.FC<PlaygroundTabbedTileProps> = ({
  tabs,
  initialTab = 0,
  className,
  childrenClassName,
  backgroundColor,
}) => {
  const contentPadding = 4;
  const [activeTab, setActiveTab] = useState(initialTab);
  const surfaceClass = backgroundColor
    ? `bg-${backgroundColor}`
    : "bg-surface-1";
  if (activeTab >= tabs.length) {
    return null;
  }
  return (
    <div
      className={`flex flex-col h-full rounded-2xl border border-white/[0.06] shadow-card text-gray-400 ${surfaceClass} ${className}`}
    >
      <div
        className="flex items-center gap-1 px-2 border-b border-b-white/[0.06] shrink-0"
        style={{
          height: `${titleHeight}px`,
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              index === activeTab
                ? "bg-surface-3 text-white"
                : "bg-transparent text-gray-500 hover:text-gray-300"
            }`}
            onClick={() => setActiveTab(index)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div
        className={`w-full ${childrenClassName}`}
        style={{
          height: `calc(100% - ${titleHeight}px)`,
          padding: `${contentPadding * 4}px`,
        }}
      >
        {tabs[activeTab].content}
      </div>
    </div>
  );
};
