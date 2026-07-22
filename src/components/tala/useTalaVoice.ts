import { useCallback, useEffect, useRef, useState } from "react";
import { TALA_DEFAULT_VOICE, TALA_KOKORO_MODEL, TALA_STORAGE } from "./talaConfig";

// ---------------------------------------------------------------------------
// TALA's voice.
//
// Primary engine: Kokoro-82M (Apache-2.0) running fully in the browser via
// kokoro-js — a genuinely humanlike female voice with zero API cost. The
// ~80 MB model downloads once and is cached by the browser afterwards.
//
// Fallback engine: the built-in Web Speech synthesis voices. Used while
// Kokoro is still downloading (so TALA is never mute) and on devices where
// WASM/WebGPU inference isn't practical.
// ---------------------------------------------------------------------------

type KokoroInstance = {
  generate: (
    text: string,
    options: { voice: string },
  ) => Promise<{ toBlob?: () => Blob; toWav?: () => ArrayBuffer }>;
};

export type TalaVoiceEngine = "kokoro" | "browser" | "none";
export type TalaVoiceStatus = "idle" | "loading" | "speaking";

/** Split text into speakable chunks so long replies start playing sooner. */
function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/[*_#`~>]/g, "") // strip any markdown the model sneaks in
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [cleaned];
  // Merge very short fragments into their neighbour so speech doesn't stutter.
  const chunks: string[] = [];
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    if (chunks.length && (part.length < 12 || chunks[chunks.length - 1].length < 40)) {
      chunks[chunks.length - 1] += " " + part;
    } else {
      chunks.push(part);
    }
  }
  return chunks;
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const preferred = [
    "samantha",
    "aria",
    "jenny",
    "libby",
    "sonia",
    "natasha",
    "zira",
    "google us english",
    "female",
  ];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pool[0] ?? null;
}

export interface UseTalaVoice {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  engine: TalaVoiceEngine;
  status: TalaVoiceStatus;
  /** 0–100 while the Kokoro model downloads; null when not loading. */
  loadProgress: number | null;
  voiceId: string;
  setVoiceId: (id: string) => void;
  speak: (text: string) => void;
  stop: () => void;
}

export function useTalaVoice(): UseTalaVoice {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TALA_STORAGE.voiceEnabled) !== "off";
    } catch {
      return true;
    }
  });
  const [engine, setEngine] = useState<TalaVoiceEngine>("none");
  const [status, setStatus] = useState<TalaVoiceStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [voiceId, setVoiceIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(TALA_STORAGE.voiceId) || TALA_DEFAULT_VOICE;
    } catch {
      return TALA_DEFAULT_VOICE;
    }
  });

  const kokoroRef = useRef<KokoroInstance | null>(null);
  const kokoroLoading = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const generationRef = useRef(0); // bumped on stop() to cancel stale playback
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(TALA_STORAGE.voiceEnabled, on ? "on" : "off");
    } catch {
      /* non-persistent */
    }
  }, []);

  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    try {
      localStorage.setItem(TALA_STORAGE.voiceId, id);
    } catch {
      /* non-persistent */
    }
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    speakingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus((s) => (s === "speaking" ? "idle" : s));
  }, []);

  // Kick off the Kokoro download in the background the first time voice is on.
  useEffect(() => {
    if (!enabled || kokoroRef.current || kokoroLoading.current) return;
    if (typeof window === "undefined") return;
    kokoroLoading.current = true;
    setEngine((e) => (e === "none" ? "browser" : e));
    setLoadProgress(0);

    (async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        const hasWebGPU = "gpu" in navigator;
        const tts = (await KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
          dtype: hasWebGPU ? "fp32" : "q8",
          device: hasWebGPU ? "webgpu" : "wasm",
          progress_callback: (p: { status?: string; progress?: number }) => {
            if (typeof p?.progress === "number") {
              setLoadProgress(Math.round(p.progress));
            }
          },
        })) as unknown as KokoroInstance;
        kokoroRef.current = tts;
        setEngine("kokoro");
      } catch (e) {
        // WASM blocked / download failed / old browser: stay on browser voices.
        console.warn("[TALA] Kokoro TTS unavailable, using browser voice.", e);
        setEngine("browser");
      } finally {
        setLoadProgress(null);
        kokoroLoading.current = false;
      }
    })();
  }, [enabled]);

  const playQueue = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    const generation = generationRef.current;
    setStatus("speaking");

    while (queueRef.current.length && generation === generationRef.current) {
      const chunk = queueRef.current.shift()!;
      const kokoro = kokoroRef.current;

      if (kokoro) {
        try {
          const audio = await kokoro.generate(chunk, { voice: voiceIdRef.current });
          if (generation !== generationRef.current) break;
          const blob = audio.toBlob
            ? audio.toBlob()
            : new Blob([audio.toWav!()], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const el = new Audio(url);
            audioRef.current = el;
            el.onended = () => resolve();
            el.onerror = () => resolve();
            el.play().catch(() => resolve());
          });
          URL.revokeObjectURL(url);
          continue;
        } catch (e) {
          console.warn("[TALA] Kokoro generation failed, falling back.", e);
        }
      }

      // Browser speech synthesis fallback.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        await new Promise<void>((resolve) => {
          const utter = new SpeechSynthesisUtterance(chunk);
          const voice = pickBrowserVoice();
          if (voice) utter.voice = voice;
          utter.rate = 1;
          utter.pitch = 1.05;
          utter.onend = () => resolve();
          utter.onerror = () => resolve();
          window.speechSynthesis.speak(utter);
        });
      }
    }

    speakingRef.current = false;
    if (generation === generationRef.current) setStatus("idle");
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      const chunks = splitSentences(text);
      if (!chunks.length) return;
      stop();
      queueRef.current = chunks;
      void playQueue();
    },
    [enabled, stop, playQueue],
  );

  // Some browsers populate speechSynthesis voices asynchronously.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, []);

  useEffect(() => stop, [stop]); // silence TALA on unmount

  return {
    enabled,
    setEnabled,
    engine,
    status,
    loadProgress,
    voiceId,
    setVoiceId,
    speak,
    stop,
  };
}
