import { useCallback, useEffect, useRef, useState } from "react";

// Minimal shape of the Web Speech API's SpeechRecognition — not in
// lib.dom.d.ts by default, and only implemented (as of writing) in
// Chromium-based browsers under the webkit-prefixed constructor.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const isSpeechRecognitionSupported = () =>
  getSpeechRecognitionCtor() !== undefined;

type UseSpeechRecognitionOptions = {
  // Called with each finalized phrase — this is the "reply" that should be
  // sent to the room/agent, transcribed entirely client-side via the
  // browser's own speech engine (no STT model/endpoint involved).
  onFinalResult: (text: string) => void;
  lang?: string;
};

// Wraps the browser's built-in SpeechRecognition into a simple
// listening/interim-transcript state machine. This exists so voice input
// can reach the agent's text-input path (see room_io's TOPIC_CHAT handler)
// without needing any STT model or server endpoint — the browser does the
// transcription locally.
export function useSpeechRecognition({
  onFinalResult,
  lang = "en-US",
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;

  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) onFinalResultRef.current(trimmed);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = () => {
      // "no-speech"/"aborted" fire constantly in continuous mode and
      // aren't real errors — onend's auto-restart handles those. Only
      // surface something if we're no longer trying to listen at all.
    };

    recognition.onend = () => {
      setInterimTranscript("");
      if (shouldRestartRef.current) {
        // Browsers stop the recognizer after a silence timeout even in
        // continuous mode; restart transparently while the user still has
        // voice input toggled on.
        try {
          recognition.start();
        } catch {
          // already starting/started — ignore
        }
      } else {
        setIsListening(false);
      }
    };

    shouldRestartRef.current = true;
    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  }, [lang]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { supported, isListening, interimTranscript, error, start, stop, toggle };
}
