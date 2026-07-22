// ---------------------------------------------------------------------------
// Live OpenRouter model catalog for the TALA admin pickers — both the chat
// brain (existing) and the voice/TTS models (added alongside OpenRouter's
// /api/v1/audio/speech launch, so TALA's voice can run on the same key and
// billing as her brain instead of a separate provider).
//
// GET /api/v1/models is public — no API key needed to list models, only to
// call them. Fetched once and cached; split into free/paid, sorted A-Z.
// ---------------------------------------------------------------------------

export interface OpenRouterModel {
  id: string;
  name: string;
  isFree: boolean;
  contextLength: number | null;
  promptPricePerM: number | null; // USD per 1M prompt tokens, null if unknown
}

interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

interface Catalog {
  chatFree: OpenRouterModel[];
  chatPaid: OpenRouterModel[];
  ttsModels: OpenRouterModel[];
}

let cache: Catalog | null = null;
let inflight: Promise<Catalog> | null = null;

function toModel(raw: RawModel): OpenRouterModel {
  const promptPrice = raw.pricing?.prompt ? Number(raw.pricing.prompt) : null;
  const isFree = raw.id.endsWith(":free") || promptPrice === 0;
  return {
    id: raw.id,
    name: raw.name || raw.id,
    isFree,
    contextLength: raw.context_length ?? null,
    promptPricePerM: promptPrice !== null ? promptPrice * 1_000_000 : null,
  };
}

const byName = (a: OpenRouterModel, b: OpenRouterModel) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

// Confirmed-real TTS model IDs (verified directly against OpenRouter's docs)
// used as a safety net if the live catalog's audio-modality filter below
// ever returns nothing — so the voice picker is never empty even if
// OpenRouter restructures the /models response.
const KNOWN_TTS_FALLBACK: RawModel[] = [
  { id: "openai/gpt-4o-mini-tts-2025-12-15", name: "GPT-4o Mini TTS (OpenAI)" },
  { id: "mistralai/voxtral-mini-tts-2603", name: "Voxtral Mini TTS (Mistral)" },
];

async function loadCatalog(): Promise<Catalog> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter model list failed: HTTP ${res.status}`);
  const body = await res.json();
  const raw: RawModel[] = Array.isArray(body?.data) ? body.data : [];

  const isTts = (m: RawModel) => (m.architecture?.output_modalities ?? []).includes("audio");
  const ttsRaw = raw.filter(isTts);
  const chatRaw = raw.filter((m) => !isTts(m));

  const ttsModels = (ttsRaw.length ? ttsRaw : KNOWN_TTS_FALLBACK).map(toModel).sort(byName);
  const chatAll = chatRaw.map(toModel);

  return {
    chatFree: chatAll.filter((m) => m.isFree).sort(byName),
    chatPaid: chatAll.filter((m) => !m.isFree).sort(byName),
    ttsModels,
  };
}

async function getCatalog(): Promise<Catalog> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = loadCatalog();
  try {
    cache = await inflight;
    return cache;
  } finally {
    inflight = null;
  }
}

export async function fetchOpenRouterModels(): Promise<{
  free: OpenRouterModel[];
  paid: OpenRouterModel[];
}> {
  const { chatFree, chatPaid } = await getCatalog();
  return { free: chatFree, paid: chatPaid };
}

/** All OpenRouter models that support audio (speech) output — for the voice picker. */
export async function fetchOpenRouterVoiceModels(): Promise<OpenRouterModel[]> {
  const { ttsModels } = await getCatalog();
  return ttsModels;
}

export function formatPrice(model: OpenRouterModel): string {
  if (model.isFree) return "Free";
  if (model.promptPricePerM === null) return "Variable pricing";
  return `$${model.promptPricePerM.toFixed(2)}/1M tokens`;
}
