import { useCallback, useRef, useState } from "react";
import {
  OPENROUTER_ENDPOINT,
  TALA_CHAT_ENDPOINT,
  TALA_FREE_MODELS,
  TALA_MAX_HISTORY,
  TALA_STORAGE,
  TALA_SUPABASE_ANON_KEY,
  type TalaMessage,
} from "./talaConfig";

interface WireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDevApiKey(): string {
  try {
    return localStorage.getItem(TALA_STORAGE.devApiKey) ?? "";
  } catch {
    return "";
  }
}

export function setDevApiKey(key: string) {
  try {
    if (key) localStorage.setItem(TALA_STORAGE.devApiKey, key);
    else localStorage.removeItem(TALA_STORAGE.devApiKey);
  } catch {
    /* storage unavailable (private mode) — dev key just won't persist */
  }
}

/**
 * Direct browser → OpenRouter call. Dev/building mode only: used when a key
 * is stored locally on this device. Production traffic should go through the
 * tala-chat edge function so the key is never exposed.
 *
 * @param preferredModel the model chosen in Admin → TALA, tried first before
 *                        falling back to the free-model chain.
 */
async function askOpenRouterDirect(
  messages: WireMessage[],
  apiKey: string,
  preferredModel?: string,
): Promise<string> {
  const chain = preferredModel
    ? [preferredModel, ...TALA_FREE_MODELS.filter((m) => m !== preferredModel)]
    : TALA_FREE_MODELS;
  let lastError = "";
  for (const model of chain) {
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          // Header values must be Latin-1 — no em dashes or other non-ASCII characters.
          "X-Title": "TALA - San Vicente Concierge",
        },
        body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 600 }),
      });
      if (!res.ok) {
        lastError = `${model}: HTTP ${res.status}`;
        // 429 = free-tier rate limit, 404 = model retired — try the next one.
        if (res.status === 429 || res.status === 404 || res.status >= 500) continue;
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || lastError);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      lastError = `${model}: empty response`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError || "All free models are busy right now.");
}

/** Production path: Supabase Edge Function proxy (key lives in Supabase secrets). */
async function askEdgeFunction(messages: WireMessage[], preferredModel?: string): Promise<string> {
  if (!TALA_CHAT_ENDPOINT) throw new Error("Supabase is not configured.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TALA_SUPABASE_ANON_KEY) {
    headers.apikey = TALA_SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${TALA_SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(TALA_CHAT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, model: preferredModel || undefined }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  }
  const text = typeof data?.reply === "string" ? data.reply.trim() : "";
  if (!text) throw new Error("TALA returned an empty reply.");
  return text;
}

export interface UseTalaChat {
  messages: TalaMessage[];
  thinking: boolean;
  error: string | null;
  send: (
    text: string,
    systemPrompt: string,
    options?: { model?: string; adminApiKey?: string },
  ) => Promise<string | null>;
  reset: () => void;
}

export function useTalaChat(): UseTalaChat {
  const [messages, setMessages] = useState<TalaMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const send = useCallback(
    async (
      text: string,
      systemPrompt: string,
      options?: { model?: string; adminApiKey?: string },
    ): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || inFlight.current) return null;
      inFlight.current = true;
      setError(null);
      setThinking(true);

      const preferredModel = options?.model;
      const userMsg: TalaMessage = { id: newId(), role: "user", content: trimmed };
      let history: TalaMessage[] = [];
      setMessages((prev) => {
        history = [...prev, userMsg];
        return history;
      });

      const wire: WireMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-TALA_MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
      ];

      try {
        // Priority: key entered in Admin → TALA (works instantly, no deploy
        // needed) → device-local dev key (building on this browser only) →
        // Supabase edge function (production path, key stays server-side).
        const key = options?.adminApiKey || getDevApiKey();
        let reply: string;
        if (key) {
          reply = await askOpenRouterDirect(wire, key, preferredModel);
        } else {
          reply = await askEdgeFunction(wire, preferredModel);
        }
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: reply }]);
        return reply;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(msg);
        return null;
      } finally {
        inFlight.current = false;
        setThinking(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, thinking, error, send, reset };
}
