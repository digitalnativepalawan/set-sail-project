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
import { executeTalaTool, TALA_TOOL_SCHEMAS } from "./talaTools";
import type { CmsData } from "@/types/cms";

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

interface AssistantReply {
  content: string | null;
  tool_calls?: ToolCallWire[];
}

const MAX_TOOL_HOPS = 3;

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
async function requestChatCompletion(
  model: string,
  messages: WireMessage[],
  apiKey: string,
  includeTools: boolean,
): Promise<{ ok: true; message: AssistantReply } | { ok: false; status: number; error: string }> {
  const body: Record<string, unknown> = { model, messages, temperature: 0.5, max_tokens: 600 };
  if (includeTools) {
    body.tools = TALA_TOOL_SCHEMAS;
    body.tool_choice = "auto";
  }
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      // Header values must be Latin-1 — no em dashes or other non-ASCII characters.
      "X-Title": "TALA - San Vicente Concierge",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    return {
      ok: false,
      status: res.status,
      error: errBody?.error?.message || `HTTP ${res.status}`,
    };
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  return { ok: true, message: { content: msg?.content ?? null, tool_calls: msg?.tool_calls } };
}

async function askOpenRouterDirect(
  messages: WireMessage[],
  apiKey: string,
  preferredModel?: string,
): Promise<AssistantReply> {
  const chain = preferredModel
    ? [preferredModel, ...TALA_FREE_MODELS.filter((m) => m !== preferredModel)]
    : TALA_FREE_MODELS;
  let lastError = "";
  for (const model of chain) {
    try {
      let result = await requestChatCompletion(model, messages, apiKey, true);
      // Not every free/open model supports function-calling — if the API
      // rejects the `tools` param outright, retry that same model without
      // it rather than treating it as dead.
      if (!result.ok && result.status === 400 && /tool|function/i.test(result.error)) {
        result = await requestChatCompletion(model, messages, apiKey, false);
      }
      if (!result.ok) {
        lastError = `${model}: ${result.error}`;
        // 429 = free-tier rate limit, 404 = model retired — try the next one.
        if (result.status === 429 || result.status === 404 || result.status >= 500) continue;
        throw new Error(lastError);
      }
      if (result.message.content || result.message.tool_calls?.length) return result.message;
      lastError = `${model}: empty response`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError || "All free models are busy right now.");
}

/** Production path: Supabase Edge Function proxy (key lives in Supabase secrets). */
async function askEdgeFunction(
  messages: WireMessage[],
  preferredModel?: string,
): Promise<AssistantReply> {
  if (!TALA_CHAT_ENDPOINT) throw new Error("Supabase is not configured.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TALA_SUPABASE_ANON_KEY) {
    headers.apikey = TALA_SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${TALA_SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(TALA_CHAT_ENDPOINT, {
    method: "POST",
    headers,
    // Tool schemas are NOT sent here — the edge function only trusts its own
    // hardcoded copy (see supabase/functions/tala-chat/index.ts), not
    // anything a client could supply.
    body: JSON.stringify({ messages, model: preferredModel || undefined }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  }
  const message = data?.message as AssistantReply | undefined;
  if (!message || (!message.content && !message.tool_calls?.length)) {
    throw new Error("TALA returned an empty reply.");
  }
  return message;
}

export interface UseTalaChat {
  messages: TalaMessage[];
  thinking: boolean;
  error: string | null;
  send: (
    text: string,
    systemPrompt: string,
    options?: { model?: string; adminApiKey?: string; cms?: CmsData },
  ) => Promise<string | null>;
  reset: () => void;
}

export function useTalaChat(): UseTalaChat {
  const [messages, setMessages] = useState<TalaMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Authoritative copy of the conversation. React state updaters are NOT
  // guaranteed to run synchronously at the setMessages() call site, so
  // building the outgoing request from inside one silently dropped the
  // user's newest message whenever React deferred the updater — the model
  // then answered a conversation containing only the system prompt.
  const messagesRef = useRef<TalaMessage[]>([]);

  const send = useCallback(
    async (
      text: string,
      systemPrompt: string,
      options?: { model?: string; adminApiKey?: string; cms?: CmsData },
    ): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || inFlight.current) return null;
      inFlight.current = true;
      setError(null);
      setThinking(true);

      const preferredModel = options?.model;
      const userMsg: TalaMessage = { id: newId(), role: "user", content: trimmed };
      const history: TalaMessage[] = [...messagesRef.current, userMsg];
      messagesRef.current = history;
      setMessages(history);

      let wire: WireMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-TALA_MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
      ];

      try {
        // Priority: key entered in Admin → TALA (works instantly, no deploy
        // needed) → device-local dev key (building on this browser only) →
        // Supabase edge function (production path, key stays server-side).
        const key = options?.adminApiKey || getDevApiKey();
        const requestReply = (msgs: WireMessage[]) =>
          key
            ? askOpenRouterDirect(msgs, key, preferredModel)
            : askEdgeFunction(msgs, preferredModel);

        let reply = await requestReply(wire);
        let hops = 0;
        while (reply.tool_calls?.length && hops < MAX_TOOL_HOPS) {
          hops++;
          wire = [
            ...wire,
            { role: "assistant", content: reply.content, tool_calls: reply.tool_calls },
          ];
          for (const call of reply.tool_calls) {
            const result = options?.cms
              ? await executeTalaTool(
                  { id: call.id, name: call.function.name, arguments: call.function.arguments },
                  options.cms,
                )
              : { error: "Tool unavailable — no site data loaded." };
            wire.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          }
          reply = await requestReply(wire);
        }

        const finalText = reply.content?.trim();
        if (!finalText) throw new Error("TALA didn't have a reply.");

        messagesRef.current = [
          ...messagesRef.current,
          { id: newId(), role: "assistant", content: finalText },
        ];
        setMessages(messagesRef.current);
        return finalText;
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
    messagesRef.current = [];
    setMessages([]);
    setError(null);
  }, []);

  return { messages, thinking, error, send, reset };
}
