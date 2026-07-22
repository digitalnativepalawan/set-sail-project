// TALA chat proxy — Supabase Edge Function.
//
// Keeps the OpenRouter API key server-side (set it once as a secret):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
// Deploy with:
//   supabase functions deploy tala-chat --no-verify-jwt
//
// The function tries each free model in order, so a rate-limited or retired
// free model never takes TALA down. Keep FREE_MODELS in sync with
// src/components/tala/talaConfig.ts, and TOOL_SCHEMAS in sync with
// src/components/tala/talaTools.ts.
//
// Tool schemas are hardcoded here rather than trusted from the client's
// request body — the client only sends messages, never tool definitions.
// This is a Deno runtime, separate from the Vite build, so it can't import
// the frontend's talaTools.ts directly; keep the two in sync by hand.

const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "check_room_availability",
      description:
        "Check which named rooms/stays are free for a given date range, using live booking records. Use this whenever a guest asks about availability, booking a specific room, or dates — never guess from memory.",
      parameters: {
        type: "object",
        properties: {
          checkIn: { type: "string", description: "Check-in date, ISO format YYYY-MM-DD." },
          checkOut: { type: "string", description: "Check-out date, ISO format YYYY-MM-DD." },
          roomName: {
            type: "string",
            description:
              "Optional: a specific room or package name to check. Omit to check all rooms.",
          },
        },
        required: ["checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_interested_guest",
      description:
        "Save a guest's interest so the human team can follow up, when they've shared enough to be worth a callback (at least a name or a way to reach them) but the conversation is ending before they reach WhatsApp themselves. Never call this without at least a contact method or name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest's name, if given." },
          contact: {
            type: "string",
            description: "Email, phone, or WhatsApp number the guest shared.",
          },
          note: {
            type: "string",
            description: "One or two sentences: what they're interested in and any useful context.",
          },
        },
        required: ["note"],
      },
    },
  },
];

const MAX_MESSAGES = 32;
const MAX_CHARS_PER_MESSAGE = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ToolCallWire {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallWire[];
  tool_call_id?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeMessage(m: unknown): WireMessage | null {
  if (!m || typeof m !== "object") return null;
  const msg = m as Record<string, unknown>;
  if (!["system", "user", "assistant", "tool"].includes(msg.role as string)) return null;

  const out: WireMessage = {
    role: msg.role as WireMessage["role"],
    content: typeof msg.content === "string" ? msg.content.slice(0, MAX_CHARS_PER_MESSAGE) : null,
  };
  if (msg.role === "tool" && typeof msg.tool_call_id === "string") {
    out.tool_call_id = msg.tool_call_id.slice(0, 200);
  }
  if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
    out.tool_calls = (msg.tool_calls as ToolCallWire[])
      .filter(
        (tc) => tc && typeof tc.id === "string" && tc.type === "function" && tc.function?.name,
      )
      .map((tc) => ({
        id: tc.id.slice(0, 200),
        type: "function",
        function: {
          name: String(tc.function.name).slice(0, 100),
          arguments: String(tc.function.arguments ?? "{}").slice(0, 4000),
        },
      }));
  }
  return out;
}

async function requestChatCompletion(
  apiKey: string,
  origin: string,
  model: string,
  messages: WireMessage[],
  includeTools: boolean,
): Promise<
  | { ok: true; content: string | null; tool_calls?: ToolCallWire[] }
  | { ok: false; status: number; error: string }
> {
  const body: Record<string, unknown> = { model, messages, temperature: 0.5, max_tokens: 600 };
  if (includeTools) {
    body.tools = TOOL_SCHEMAS;
    body.tool_choice = "auto";
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": origin,
      "X-Title": "TALA - San Vicente Concierge",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    return {
      ok: false,
      status: res.status,
      error: errBody?.error?.message ?? `HTTP ${res.status}`,
    };
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  return { ok: true, content: msg?.content ?? null, tool_calls: msg?.tool_calls };
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
      .map(sanitizeMessage)
      .filter((m: WireMessage | null): m is WireMessage => m !== null)
      .slice(-MAX_MESSAGES);
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
  const origin = req.headers.get("origin") ?? "https://sanvic.ph";

  let lastError = "";
  for (const model of chain) {
    try {
      let result = await requestChatCompletion(apiKey, origin, model, messages, true);
      // Not every free/open model supports function-calling — if the API
      // rejects the `tools` param outright, retry without it.
      if (!result.ok && result.status === 400 && /tool|function/i.test(result.error)) {
        result = await requestChatCompletion(apiKey, origin, model, messages, false);
      }
      if (!result.ok) {
        // Whatever the reason (429 rate limit, 404 retired, 4xx/5xx from a
        // misconfigured model) — just try the next model in the chain.
        lastError = `${model}: ${result.error}`;
        continue;
      }
      if (result.content || result.tool_calls?.length) {
        return json({ message: { content: result.content, tool_calls: result.tool_calls }, model });
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
