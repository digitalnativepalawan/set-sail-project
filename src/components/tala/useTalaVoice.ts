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

export type TalaVoiceEngine = "kokoro" | "browser" | "none";
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
  // Merge very short fragments into their neighbour so speech doesn't stutter —
  // BUT let the first chunk stay short so TALA starts talking sooner. A brief
  // opener ("Sure —") synthesizes in a fraction of the time of a full sentence.
  const chunks: string[] = [];
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    if (chunks.length && (part.length < 12 || chunks[chunks.length - 1].length < 40)) {
      chunks[chunks.length - 1] += " " + part;
    } else {
      chunks.push(part);
    }
  }
  // If the first chunk is still very long, break off a short opening clause
  // at the first comma / semicolon / dash so playback can start sooner.
  if (chunks.length && chunks[0].length > 90) {
    const first = chunks[0];
    const splitAt = first.search(/[,;:—–]\s/);
    if (splitAt > 12 && splitAt < 70) {
      const head = first.slice(0, splitAt + 1).trim();
      const tail = first.slice(splitAt + 1).trim();
      if (head && tail) chunks.splice(0, 1, head, tail);
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
}

export function useTalaVoice(options?: UseTalaVoiceOptions): UseTalaVoice {
  const siteDefaultVoice = options?.defaultVoiceId || TALA_DEFAULT_VOICE;
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

  // Kick off the Kokoro download in the background as soon as voice is on —
  // ideally while the user is still reading the greeting and typing, so the
  // ~80 MB model is ready by the time the first assistant reply arrives.
  useEffect(() => {
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
        //
        // dtype: prefer q4f16 (smaller download, faster CPU inference, no
        // audible quality loss for a concierge voice); fall back to q8 if a
        // browser/runtime rejects the newer quantization.
        const loadWith = (dtype: "q4f16" | "q8") =>
          KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
            dtype,
            device: "wasm",
            progress_callback: (p: { status?: string; progress?: number }) => {
              if (typeof p?.progress === "number") {
                setLoadProgress(Math.round(p.progress));
              }
            },
          });
        let tts: KokoroInstance;
        try {
          tts = (await loadWith("q4f16")) as unknown as KokoroInstance;
        } catch (fastErr) {
          console.warn("[TALA] Kokoro q4f16 unavailable, falling back to q8.", fastErr);
          tts = (await loadWith("q8")) as unknown as KokoroInstance;
        }
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
  }, [enabled]);

  const playQueue = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    const generation = generationRef.current;
    setStatus("speaking");

    const kokoro = kokoroRef.current;

    if (kokoro) {
      // Pipeline: while chunk N plays, synthesize chunk N+1 in the background.
      // First-chunk latency is unchanged (a hard floor), but subsequent chunks
      // start with no gap. Bounded look-ahead of 1 keeps memory in check.
      const ready: Array<{ url: string }> = [];
      let producerDone = false;
      let producerError = false;
      let notify: (() => void) | null = null;
      const waitForReady = () =>
        new Promise<void>((resolve) => {
          notify = resolve;
        });
      const wake = () => {
        const n = notify;
        notify = null;
        if (n) n();
      };

      const producer = (async () => {
        try {
          while (queueRef.current.length && generation === generationRef.current) {
            // Cap look-ahead at 1 pre-rendered blob.
            while (ready.length >= 1 && generation === generationRef.current) {
              await new Promise<void>((r) => {
                notify = r;
              });
            }
            if (generation !== generationRef.current) break;
            const chunk = queueRef.current.shift();
            if (!chunk) break;
            try {
              const audio = await kokoro.generate(chunk, { voice: voiceIdRef.current });
              if (generation !== generationRef.current) break;
              const blob = encodePCM16Wav(audio.audio, audio.sampling_rate);
              ready.push({ url: URL.createObjectURL(blob) });
              wake();
            } catch (e) {
              console.warn("[TALA] Kokoro generation failed.", e);
              producerError = true;
              break;
            }
          }
        } finally {
          producerDone = true;
          wake();
        }
      })();

      // Consumer: play blobs in order as they arrive.
      while (generation === generationRef.current) {
        if (!ready.length) {
          if (producerDone) break;
          await waitForReady();
          continue;
        }
        const { url } = ready.shift()!;
        wake(); // producer may be waiting for room
        await new Promise<void>((resolve) => {
          const el = new Audio(url);
          audioRef.current = el;
          el.onended = () => resolve();
          el.onerror = () => resolve();
          el.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        if (generation !== generationRef.current) break;
      }

      // Drain any leftover blobs on cancel.
      for (const item of ready) URL.revokeObjectURL(item.url);
      ready.length = 0;
      await producer.catch(() => {});

      // If Kokoro blew up mid-reply, fall through to browser voice for the rest.
      if (producerError && queueRef.current.length && generation === generationRef.current) {
        // fall through to the browser-speech loop below
      } else {
        speakingRef.current = false;
        if (generation === generationRef.current) setStatus("idle");
        return;
      }
    }

    // Browser speech synthesis fallback (no Kokoro, or Kokoro failed).
    while (queueRef.current.length && generation === generationRef.current) {
      const chunk = queueRef.current.shift()!;
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
      if (!kokoroRef.current && kokoroLoading.current) {
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
    engine,
    status,
    loadProgress,
    voiceId,
    setVoiceId,
    speak,
    stop,
  };
}
