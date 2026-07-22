# TALA — AI Voice Concierge

TALA is the site's AI friend, guide and concierge for San Vicente, ported from
the [KAPWA Resort OS agent](https://github.com/merqatodigital/working-AI-agent).
She lives in a floating widget on every public page (the gold sparkle button
above the WhatsApp float), answers questions about the property grounded in
live CMS data (rooms, pricing, Starlink speed, FAQs), and hands guests to
WhatsApp when they're ready to book.

Everything is free or open source:

| Piece | Technology | Cost |
|---|---|---|
| Brain | OpenRouter **free models** with automatic fallback chain | $0 |
| Voice out | **Kokoro-82M** (Apache-2.0) running in the visitor's browser via `kokoro-js` | $0 |
| Voice in | Browser Web Speech API (Chrome / Edge / Safari) | $0 |
| Key security | Supabase Edge Function `tala-chat` proxy | $0 |

## One-time setup (production)

TALA needs your OpenRouter API key stored as a **Supabase secret** — it never
ships to the browser.

1. Get a key at https://openrouter.ai/keys (free models work with a $0 balance).
2. In the Supabase dashboard for project `nfirbrpnmgsrvoomtokn`:
   **Edge Functions → Secrets → Add secret** → name `OPENROUTER_API_KEY`,
   value `sk-or-...`
   (or via CLI: `supabase secrets set OPENROUTER_API_KEY=sk-or-...`)
3. Deploy the function (skip if Lovable auto-deploys it on sync):
   ```bash
   supabase functions deploy tala-chat --no-verify-jwt
   ```

That's it. The widget calls `<SUPABASE_URL>/functions/v1/tala-chat`.

## Building / local dev without the edge function

Open the widget → gear icon → paste an OpenRouter key into **Dev OpenRouter
key**. It's stored only in that browser's localStorage and the widget then
calls OpenRouter directly. Leave it empty in production.

## The voice

- Default voice is Kokoro's `af_heart` (warm, natural female). Pick others in
  the widget settings (Bella, Nicole, Aoede, British Emma).
- The ~80 MB voice model downloads in the background on first use and is
  cached by the browser afterwards. Until it's ready, TALA speaks with the
  built-in browser voice so she's never mute.
- Voice on/off and the chosen voice persist per device.

## Keeping the free models fresh

Free OpenRouter model IDs change over time. The fallback chain lives in **two
places — keep them in sync**:

- `src/components/tala/talaConfig.ts` → `TALA_FREE_MODELS`
- `supabase/functions/tala-chat/index.ts` → `FREE_MODELS`

Check current free models at https://openrouter.ai/models?q=free. If every
model in the chain is rate-limited, TALA shows a friendly "busy right now"
message.

## Where the code lives

```
src/components/tala/
├── TalaWidget.tsx     UI — launcher, chat panel, mic, settings
├── talaPersona.ts     System prompt (built from live CMS data)
├── talaConfig.ts      Models, endpoints, voices, storage keys
├── useTalaChat.ts     Chat state + edge-function / dev-key transport
├── useTalaVoice.ts    Kokoro TTS engine + browser-voice fallback
└── useSpeechInput.ts  Web Speech API microphone input

supabase/functions/tala-chat/index.ts   OpenRouter proxy (key stays server-side)
```

The widget is mounted in `src/pages/PublicLayout.tsx`, so it appears on the
home page and blog but not in `/admin`.
