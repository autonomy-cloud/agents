import React from "react";
import { AttributeItem } from "@/lib/types";

interface AttributeRowProps {
  attribute: AttributeItem;
  onKeyChange: (id: string, newKey: string) => void;
  onValueChange: (id: string, newValue: string) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
  keyError?: string;
}

export const AttributeRow: React.FC<AttributeRowProps> = ({
  attribute,
  onKeyChange,
  onValueChange,
  onRemove,
  disabled = false,
  keyError,
}) => {
  return (
    <div className="flex flex-col mb-2">
      <div className="flex items-center gap-2">
        <input
          value={attribute.key}
          onChange={(e) => onKeyChange(attribute.id, e.target.value)}
          className={`flex-1 min-w-0 text-sm bg-gray-100/90 dark:bg-surface-2/70 border rounded-lg px-3 py-1.5 font-mono outline-none transition-colors ${
            keyError
              ? "border-red-800 text-red-400"
              : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 focus:border-gray-300 dark:focus:border-white/25"
          }`}
          placeholder="Name"
          disabled={disabled}
        />
        <input
          value={attribute.value}
          onChange={(e) => onValueChange(attribute.id, e.target.value)}
          className="flex-1 min-w-0 text-gray-600 dark:text-gray-300 text-sm bg-gray-100/90 dark:bg-surface-2/70 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 font-mono outline-none transition-colors focus:border-gray-300 dark:focus:border-white/25"
          placeholder="Value"
          disabled={disabled}
        />
        {onRemove && (
          <button
            onClick={() => onRemove(attribute.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            disabled={disabled}
            style={{ display: disabled ? "none" : "flex" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      {keyError && (
        <span className="text-red-400 text-xs mt-1">{keyError}</span>
      )}
    </div>
  );
};
