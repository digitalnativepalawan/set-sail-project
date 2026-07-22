// ---------------------------------------------------------------------------
// Live OpenRouter model catalog for the TALA admin picker.
//
// GET /api/v1/models is public — no API key needed to list models, only to
// call them. We fetch it once, split into Free / Paid, and sort each group
// alphabetically by display name, exactly as requested for the admin picker.
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
}

let cache: { free: OpenRouterModel[]; paid: OpenRouterModel[] } | null = null;
let inflight: Promise<{ free: OpenRouterModel[]; paid: OpenRouterModel[] }> | null = null;

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

export async function fetchOpenRouterModels(): Promise<{
  free: OpenRouterModel[];
  paid: OpenRouterModel[];
}> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`OpenRouter model list failed: HTTP ${res.status}`);
    const body = await res.json();
    const raw: RawModel[] = Array.isArray(body?.data) ? body.data : [];
    const all = raw.map(toModel);

    const byName = (a: OpenRouterModel, b: OpenRouterModel) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

    const result = {
      free: all.filter((m) => m.isFree).sort(byName),
      paid: all.filter((m) => !m.isFree).sort(byName),
    };
    cache = result;
    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function formatPrice(model: OpenRouterModel): string {
  if (model.isFree) return "Free";
  if (model.promptPricePerM === null) return "Variable pricing";
  return `$${model.promptPricePerM.toFixed(2)}/1M tokens`;
}
