// TALA chat proxy — Supabase Edge Function.
//
// Keeps the OpenRouter API key server-side (set it once as a secret):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
// Deploy with:
//   supabase functions deploy tala-chat --no-verify-jwt
//
// The function tries each free model in order, so a rate-limited or retired
// free model never takes TALA down. Keep this list in sync with
// src/components/tala/talaConfig.ts.

const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MESSAGE = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return json(
      { error: "TALA is not configured yet: set the OPENROUTER_API_KEY secret in Supabase." },
      500,
    );
  }

  // OpenRouter model ids look like "provider/model-name" or "provider/model-name:variant".
  const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

  let messages: WireMessage[];
  let preferredModel: string | undefined;
  try {
    const body = await req.json();
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return json({ error: "messages array is required" }, 400);
    }
    messages = body.messages
      .filter(
        (m: WireMessage) =>
          m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string",
      )
      .slice(-MAX_MESSAGES)
      .map((m: WireMessage) => ({
        role: m.role,
        content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
      }));
    if (!messages.length) return json({ error: "no valid messages" }, 400);

    // The model admin picked in Admin → TALA (see openRouterModels.ts). Tried
    // first, then we fall through to the free-model chain if it fails.
    if (typeof body?.model === "string" && MODEL_ID_PATTERN.test(body.model)) {
      preferredModel = body.model.slice(0, 200);
    }
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const chain = preferredModel
    ? [preferredModel, ...FREE_MODELS.filter((m) => m !== preferredModel)]
    : FREE_MODELS;

  let lastError = "";
  for (const model of chain) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": req.headers.get("origin") ?? "https://sanvic.ph",
          "X-Title": "TALA - San Vicente Concierge",
        },
        body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 600 }),
      });

      if (!res.ok) {
        lastError = `${model}: HTTP ${res.status}`;
        // 429 = free-tier rate limit, 404 = model retired — try the next model.
        if (res.status === 429 || res.status === 404 || res.status >= 500) continue;
        const errBody = await res.json().catch(() => null);
        lastError = errBody?.error?.message ?? lastError;
        continue;
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return json({ reply, model });
      }
      lastError = `${model}: empty response`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return json(
    {
      error: `TALA's free models are all busy right now — please try again in a moment. (${lastError})`,
    },
    503,
  );
});
