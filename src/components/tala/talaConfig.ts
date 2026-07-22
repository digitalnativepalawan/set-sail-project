// ---------------------------------------------------------------------------
// TALA — central configuration.
//
// TALA is the site's AI concierge, ported from the KAPWA Resort OS agent
// (github.com/merqatodigital/working-AI-agent). The Python backend's
// LangGraph pipeline is replaced here by a single chat completion against
// OpenRouter, proxied through the `tala-chat` Supabase Edge Function so the
// API key stays server-side. Voice is fully in-browser and free:
// Kokoro-82M (open source) for speech out, Web Speech API for speech in.
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Supabase Edge Function endpoint that proxies OpenRouter (keeps the key secret). */
export const TALA_CHAT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/tala-chat` : null;

export const TALA_SUPABASE_ANON_KEY = SUPABASE_KEY ?? null;

/** Direct OpenRouter endpoint — used only in dev mode with a locally stored key. */
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Free OpenRouter models, tried in order until one answers. Free-tier IDs
 * churn over time — keep this list fresh from https://openrouter.ai/models?q=free
 * The edge function shares this list; update both together.
 */
export const TALA_FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
] as const;

/** localStorage keys (device-local preferences, never synced). */
export const TALA_STORAGE = {
  /** Dev-only OpenRouter key for building without the edge function deployed. */
  devApiKey: "tala.devOpenRouterKey",
  voiceEnabled: "tala.voiceEnabled",
  voiceId: "tala.voiceId",
  model: "tala.model",
} as const;

/**
 * Kokoro-82M voices (open source, Apache-2.0). All run in-browser via
 * kokoro-js — no API, no cost. `af_heart` is the most natural female voice.
 */
export const TALA_KOKORO_VOICES = [
  { id: "af_heart", label: "Heart — warm female (default)" },
  { id: "af_bella", label: "Bella — bright female" },
  { id: "af_nicole", label: "Nicole — soft female" },
  { id: "af_aoede", label: "Aoede — calm female" },
  { id: "bf_emma", label: "Emma — British female" },
] as const;

export const TALA_DEFAULT_VOICE = "af_heart";

/** Hugging Face model id for the in-browser TTS engine. ~80 MB, cached after first load. */
export const TALA_KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Hard cap on conversation turns sent to the model (cost + context control). */
export const TALA_MAX_HISTORY = 16;

export interface TalaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
