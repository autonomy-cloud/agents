import { useCallback, useEffect, useRef } from "react";

export const isSpeechSynthesisSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

// Speaks agent replies out loud using the browser's built-in TTS
// (SpeechSynthesis API) — the output-side mirror of useSpeechRecognition.
// This exists so the agent has a real voice today even before a real
// OPENAGENTS_OPENAI_BASE_URL/TTS model is configured; it's meant as a
// fallback, not a permanent second voice, so callers should stop feeding
// it text once the agent has its own real published audio track (see
// Playground.tsx's usage — gated on `!agent.microphoneTrack`) to avoid two
// voices talking over each other once real TTS is working.
export function useSpeechSynthesis() {
  const supported = isSpeechSynthesisSupported();
  const enabledRef = useRef(true);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabledRef.current || !text.trim()) return;
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      enabledRef.current = enabled;
      if (!enabled) cancel();
    },
    [cancel],
  );

  return { supported, speak, cancel, setEnabled };
}
