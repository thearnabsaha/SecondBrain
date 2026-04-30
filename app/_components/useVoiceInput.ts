"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper over the browser's SpeechRecognition (a.k.a.
 * webkitSpeechRecognition) API. Returns a stable surface the UI can use:
 *
 *   const { supported, listening, start, stop, error, interim } = useVoiceInput(
 *     (finalText) => append finalText to the textarea
 *   );
 *
 * - `supported` is false on browsers without the API (Firefox today).
 * - `interim` is the live, low-confidence transcription shown while speaking.
 * - `start()` requests mic permission and begins recognition.
 * - `stop()` ends the session; the final, high-confidence transcript is
 *   delivered to the `onFinal` callback.
 *
 * Designed to be invisible if unsupported — components decide whether to
 * render a mic button based on `supported`.
 */
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceInputResult {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceInput(
  onFinal: (text: string) => void,
): UseVoiceInputResult {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = getSpeechCtor();
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    setError(null);
    setInterim("");
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      let interimText = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0]?.transcript ?? "";
        if (r.isFinal) finalChunk += transcript;
        else interimText += transcript;
      }
      if (finalChunk) {
        onFinalRef.current(finalChunk);
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      // "no-speech" and "aborted" are routine — only show real errors.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Voice error: ${e.error}`);
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(`Couldn't start microphone: ${(err as Error).message}`);
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        // ignore — already stopped
      }
    }
  }, []);

  // Stop recognition if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { supported, listening, interim, error, start, stop };
}
