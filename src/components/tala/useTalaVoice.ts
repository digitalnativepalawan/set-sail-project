import { useCallback, useEffect, useRef, useState } from "react";
import {
  OPENROUTER_TTS_ENDPOINT,
  TALA_DEFAULT_VOICE,
  TALA_KOKORO_MODEL,
  TALA_STORAGE,
} from "./talaConfig";

// ---------------------------------------------------------------------------
// TALA's voice.
//
// Default engine: Kokoro-82M (Apache-2.0) running fully in the browser via
// kokoro-js — a genuinely humanlike female voice with zero API cost. The
// ~80 MB model downloads once and is cached by the browser afterwards, but
// that first download is real, felt latency before she can speak at all.
//
// Optional engine: OpenRouter's hosted TTS API (/api/v1/audio/speech) — the
// same key/billing already used for TALA's chat brain, no separate voice
// provider needed. No local model to download, so no first-load lag; real
// per-character cost, but genuinely humanlike hosted voices (MiniMax,
// GPT-4o Mini TTS, Voxtral, etc.), admin-selectable in Admin -> TALA.
//
// Universal fallback: the built-in Web Speech synthesis voices, used only
// if the chosen engine fails or (for Kokoro) is still downloading.
// ---------------------------------------------------------------------------

async function synthesizeOpenRouterTts(
  text: string,
  config: { apiKey: string; model: string; voice: string },
): Promise<Blob> {
  const res = await fetch(OPENROUTER_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "TALA - San Vicente Concierge",
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      voice: config.voice,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      message = errBody?.error?.message || message;
    } catch {
      /* error responses are JSON per the API's own docs; ignore parse failures */
    }
    throw new Error(message);
  }
  const bytes = await res.arrayBuffer();
  return new Blob([bytes], { type: "audio/mpeg" });
}

// Kokoro's generate() resolves a RawAudio: raw Float32 PCM samples + sample
// rate, not an encoded file. Its own .toBlob() helper wraps that as 32-bit
// float WAV (format code 3), which some browsers' <audio> pipeline decodes
// incorrectly — heard as static/garbled "underwater" audio. We encode our
// own standard 16-bit integer PCM WAV (format code 1) instead, which every
// browser plays back correctly.
type KokoroRawAudio = { audio: Float32Array; sampling_rate: number };
type KokoroInstance = {
  generate: (text: string, options: { voice: string }) => Promise<KokoroRawAudio>;
};

function encodePCM16Wav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // format 1 = integer PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export type TalaVoiceEngine = "kokoro" | "openrouter" | "browser" | "none";
export type TalaVoiceStatus = "idle" | "loading" | "speaking";

/**
 * Rewrite text the way a person would say it out loud. The TTS phonemizer
 * reads "PHP 3,500", "Mbps" and raw URLs literally, which is most of what
 * made TALA's pronunciation sound off — normalize those before synthesis.
 */
function normalizeForSpeech(text: string): string {
  return (
    text
      // currency: "PHP 3,500" / "₱3,500" → "3,500 pesos"; stray "PHP" → "pesos"
      .replace(/(?:PHP|₱)\s?([\d,]+(?:\.\d+)?)/gi, "$1 pesos")
      .replace(/\bPHP\b/g, "pesos")
      .replace(/\$\s?([\d,]+(?:\.\d+)?)/g, "$1 dollars")
      // units & tech shorthand
      .replace(/\b(\d+)\s?Mbps\b/gi, "$1 megabits per second")
      .replace(/\b(\d+)\s?Gbps\b/gi, "$1 gigabits per second")
      .replace(/\b(\d+)\s?(?:sqm|m²)\b/gi, "$1 square meters")
      .replace(/\b24\/7\b/g, "twenty-four seven")
      // links & handles: never read a URL character by character
      .replace(/https?:\/\/wa\.me\/\S+/gi, "our WhatsApp")
      .replace(/https?:\/\/\S+/gi, "our website")
      .replace(/\bwww\.\S+/gi, "our website")
      // common abbreviations
      .replace(/\be\.g\.\s?/gi, "for example, ")
      .replace(/\betc\.?\b/gi, "and so on")
      .replace(/\bvs\.?\b/gi, "versus")
      // punctuation the phonemizer mangles → natural pauses
      .replace(/\s[—–]\s?/g, ", ")
      .replace(/&/g, " and ")
      .replace(/\s?\/\s?/g, " or ")
  );
}

/** Split text into speakable chunks so long replies start playing sooner. */
function splitSentences(text: string): string[] {
  const cleaned = normalizeForSpeech(text)
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

export interface UseTalaVoiceOptions {
  /**
   * Site-wide default voice, set in Admin → TALA. Used only when this
   * device has no voice preference of its own yet — an explicit per-visitor
   * choice (stored in their own localStorage) always wins after that.
   */
  defaultVoiceId?: string;
  /** "openrouter" only takes effect when apiKey + ttsModelId + ttsVoiceId are all set; otherwise falls back to "kokoro". */
  provider?: "kokoro" | "openrouter";
  /** OpenRouter API key (same one used for chat) — required for the openrouter provider. */
  apiKey?: string;
  /** OpenRouter TTS model id, e.g. "mistralai/voxtral-mini-tts-2603". */
  ttsModelId?: string;
  /** Voice id for the chosen TTS model (each model defines its own set). */
  ttsVoiceId?: string;
}

export function useTalaVoice(options?: UseTalaVoiceOptions): UseTalaVoice {
  const siteDefaultVoice = options?.defaultVoiceId || TALA_DEFAULT_VOICE;
  const openRouterReady = Boolean(options?.apiKey && options?.ttsModelId && options?.ttsVoiceId);
  const provider: "kokoro" | "openrouter" =
    options?.provider === "openrouter" && openRouterReady ? "openrouter" : "kokoro";
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
      return localStorage.getItem(TALA_STORAGE.voiceId) || siteDefaultVoice;
    } catch {
      return siteDefaultVoice;
    }
  });

  const kokoroRef = useRef<KokoroInstance | null>(null);
  const kokoroLoading = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const generationRef = useRef(0); // bumped on stop() to cancel stale playback
  // playQueue/speak are stable useCallbacks (empty deps) but need the latest
  // provider/config on every call — kept in refs rather than closed-over state.
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const orConfigRef = useRef<{ apiKey: string; model: string; voice: string } | null>(null);
  orConfigRef.current =
    provider === "openrouter"
      ? { apiKey: options!.apiKey!, model: options!.ttsModelId!, voice: options!.ttsVoiceId! }
      : null;
  // While Kokoro is still downloading, hold speech instead of using the
  // robotic browser fallback — that fallback is what "TALA sounds robotic"
  // reports actually were. If the download outlasts the cap, speak anyway.
  const pendingSpeakRef = useRef(false);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playQueueRef = useRef<(() => Promise<void>) | null>(null);
  const KOKORO_WAIT_CAP_MS = 45000;
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
    pendingSpeakRef.current = false;
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus((s) => (s === "speaking" ? "idle" : s));
  }, []);

  // Kick off the Kokoro download in the background the first time voice is on
  // — but only when Kokoro is actually the engine in use. The whole point of
  // the OpenRouter provider is no local model download, so skip this
  // entirely rather than wasting 80 MB of bandwidth nobody will use.
  useEffect(() => {
    if (provider !== "kokoro") return;
    if (!enabled || kokoroRef.current || kokoroLoading.current) return;
    if (typeof window === "undefined") return;
    kokoroLoading.current = true;
    setEngine((e) => (e === "none" ? "browser" : e));
    setLoadProgress(0);

    (async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        // WebGPU inference has real, reported bugs on some Windows GPU/driver
        // combinations that corrupt the generated audio into static/noise —
        // the model runs without error, but the output samples are garbage.
        // WASM (CPU) is slower to load but produces correct audio everywhere,
        // so we use it unconditionally rather than opportunistically trying
        // WebGPU first.
        const tts = (await KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
          dtype: "q8",
          device: "wasm",
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
        // Flush any reply that was held back waiting for the natural voice.
        if (pendingSpeakRef.current) {
          pendingSpeakRef.current = false;
          if (waitTimerRef.current) {
            clearTimeout(waitTimerRef.current);
            waitTimerRef.current = null;
          }
          void playQueueRef.current?.();
        }
      }
    })();
  }, [enabled, provider]);

  const playQueue = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    const generation = generationRef.current;
    setStatus("speaking");

    const playBlob = async (blob: Blob) => {
      if (generation !== generationRef.current) return;
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const el = new Audio(url);
        audioRef.current = el;
        el.onended = () => resolve();
        el.onerror = () => resolve();
        el.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    };

    while (queueRef.current.length && generation === generationRef.current) {
      const chunk = queueRef.current.shift()!;

      if (providerRef.current === "openrouter" && orConfigRef.current) {
        try {
          const blob = await synthesizeOpenRouterTts(chunk, orConfigRef.current);
          await playBlob(blob);
          continue;
        } catch (e) {
          console.warn("[TALA] OpenRouter TTS failed, falling back to browser voice.", e);
        }
      } else if (kokoroRef.current) {
        try {
          const audio = await kokoroRef.current.generate(chunk, { voice: voiceIdRef.current });
          if (generation !== generationRef.current) break;
          await playBlob(encodePCM16Wav(audio.audio, audio.sampling_rate));
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

  // The load effect (defined above) needs to flush held speech when the
  // download finishes; it runs before playQueue exists, so it goes via a ref.
  playQueueRef.current = playQueue;

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      const chunks = splitSentences(text);
      if (!chunks.length) return;
      stop();
      queueRef.current = chunks;
      // Natural voice still downloading? Hold the reply instead of speaking
      // it robotically — the wait cap keeps a slow connection from muting
      // TALA forever. Once cached (second visit onward) this never waits.
      // Irrelevant for the OpenRouter provider: there's no local download.
      if (providerRef.current === "kokoro" && !kokoroRef.current && kokoroLoading.current) {
        pendingSpeakRef.current = true;
        setStatus("loading");
        waitTimerRef.current = setTimeout(() => {
          if (pendingSpeakRef.current) {
            pendingSpeakRef.current = false;
            void playQueue();
          }
        }, KOKORO_WAIT_CAP_MS);
        return;
      }
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
    engine: provider === "openrouter" ? "openrouter" : engine,
    status,
    loadProgress: provider === "openrouter" ? null : loadProgress,
    voiceId,
    setVoiceId,
    speak,
    stop,
  };
}
