import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { buildTalaSystemPrompt, talaGreeting } from "./talaPersona";
import { useTalaChat, getDevApiKey, setDevApiKey } from "./useTalaChat";
import { useTalaVoice } from "./useTalaVoice";
import { useSpeechInput } from "./useSpeechInput";
import { TALA_KOKORO_VOICES } from "./talaConfig";

// ---------------------------------------------------------------------------
// TALA — floating AI concierge widget. Sits above the WhatsApp float on the
// public site. Chat is powered by OpenRouter free models (via the tala-chat
// edge function); the voice is Kokoro-82M running in the visitor's browser.
// ---------------------------------------------------------------------------

const GREEN = "#1F3D2B";
const GREEN_DARK = "#16301F";
const GOLD = "#C6A15B";
const CREAM = "#FAF6EF";
const INK = "#26221C";

export function TalaWidget() {
  const { data } = useCms();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [devKey, setDevKeyState] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useTalaChat();
  const voice = useTalaVoice();

  const systemPrompt = useMemo(() => buildTalaSystemPrompt(data), [data]);
  const greeting = useMemo(() => talaGreeting(data), [data]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.thinking) return;
    setInput("");
    voice.stop();
    const reply = await chat.send(trimmed, systemPrompt);
    if (reply) voice.speak(reply);
  };

  const speech = useSpeechInput((finalText) => void submit(finalText));

  useEffect(() => {
    if (open) setDevKeyState(getDevApiKey());
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.thinking, open]);

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      voice.stop(); // barge-in: TALA goes quiet when the guest speaks
      speech.start();
    }
  };

  const voiceStatusLabel =
    voice.loadProgress !== null
      ? `Loading natural voice… ${voice.loadProgress}%`
      : voice.engine === "kokoro"
        ? "Natural voice ready"
        : voice.engine === "browser"
          ? "Standard voice (natural voice downloads in background)"
          : "";

  return (
    <>
      {/* Launcher — stacked above the WhatsApp float */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with TALA, your AI guide"
          className="group fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_6px_20px_rgba(31,61,43,0.45)] transition-all duration-200 hover:scale-110 active:scale-95 sm:bottom-24 sm:right-6 sm:h-14 sm:w-14"
          style={{ backgroundColor: GREEN }}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:animate-ping group-hover:opacity-60"
            style={{ backgroundColor: `${GREEN}66` }}
          />
          <Sparkles className="relative h-5 w-5 sm:h-6 sm:w-6" style={{ color: GOLD }} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border shadow-[0_18px_60px_rgba(38,34,28,0.35)] sm:bottom-6 sm:right-6"
          style={{ backgroundColor: CREAM, borderColor: `${GOLD}55`, height: "min(72vh, 600px)" }}
          role="dialog"
          aria-label="TALA chat"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${GOLD}33`, border: `1px solid ${GOLD}88` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-none tracking-wide">TALA</p>
              <p className="mt-0.5 truncate text-[11px] text-white/70">
                Your friend in San Vicente
              </p>
            </div>
            <button
              onClick={() =>
                voice.enabled ? (voice.stop(), voice.setEnabled(false)) : voice.setEnabled(true)
              }
              aria-label={voice.enabled ? "Turn voice off" : "Turn voice on"}
              className="rounded-full p-2 transition-colors hover:bg-white/10"
              title={voice.enabled ? "Voice on" : "Voice off"}
            >
              {voice.enabled ? (
                <Volume2 className="h-4 w-4" style={{ color: GOLD }} />
              ) : (
                <VolumeX className="h-4 w-4 text-white/60" />
              )}
            </button>
            <button
              onClick={() => setShowSettings((s) => !s)}
              aria-label="TALA settings"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <Settings2 className="h-4 w-4 text-white/80" />
            </button>
            <button
              onClick={() => {
                voice.stop();
                setOpen(false);
              }}
              aria-label="Close TALA"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          </div>

          {/* Voice status strip */}
          {voice.enabled && voiceStatusLabel && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 text-[11px]"
              style={{ backgroundColor: `${GOLD}1A`, color: INK }}
            >
              {voice.loadProgress !== null && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="opacity-70">{voiceStatusLabel}</span>
            </div>
          )}

          {/* Settings */}
          {showSettings && (
            <div
              className="border-b px-4 py-3 text-xs"
              style={{ borderColor: `${GOLD}33`, color: INK }}
            >
              <label className="mb-1 block font-medium">Voice</label>
              <select
                value={voice.voiceId}
                onChange={(e) => voice.setVoiceId(e.target.value)}
                className="mb-3 w-full rounded-md border bg-white px-2 py-1.5"
                style={{ borderColor: `${GOLD}55` }}
              >
                {TALA_KOKORO_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <label className="mb-1 block font-medium">
                Dev OpenRouter key{" "}
                <span className="font-normal opacity-60">
                  (this device only — for building without the edge function)
                </span>
              </label>
              <input
                type="password"
                value={devKey}
                onChange={(e) => {
                  setDevKeyState(e.target.value);
                  setDevApiKey(e.target.value.trim());
                }}
                placeholder="sk-or-… (leave empty in production)"
                className="mb-3 w-full rounded-md border bg-white px-2 py-1.5"
                style={{ borderColor: `${GOLD}55` }}
              />
              <button
                onClick={() => {
                  voice.stop();
                  chat.reset();
                  setShowSettings(false);
                }}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors hover:bg-white"
                style={{ borderColor: `${GOLD}55` }}
              >
                <RotateCcw className="h-3 w-3" /> Clear conversation
              </button>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble role="assistant" text={greeting} />
            {chat.messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.content} />
            ))}
            {chat.thinking && (
              <div className="flex items-center gap-2 text-xs" style={{ color: `${INK}99` }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: GOLD }} />
                TALA is thinking…
              </div>
            )}
            {chat.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {chat.error}
              </p>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
            className="flex items-center gap-2 border-t px-3 py-3"
            style={{ borderColor: `${GOLD}33`, backgroundColor: "#FFFFFF" }}
          >
            {speech.supported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={speech.listening ? "Stop listening" : "Speak to TALA"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95"
                style={{ backgroundColor: speech.listening ? "#B4433A" : GREEN }}
              >
                {speech.listening ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            <input
              ref={inputRef}
              value={speech.listening ? speech.transcript : input}
              onChange={(e) => setInput(e.target.value)}
              readOnly={speech.listening}
              placeholder={speech.listening ? "Listening…" : "Ask TALA anything…"}
              className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: `${GOLD}55`, color: INK }}
            />
            <button
              type="submit"
              disabled={chat.thinking || (!input.trim() && !speech.listening)}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: GREEN }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
        style={
          isUser
            ? { backgroundColor: GREEN, color: "#FFFFFF", borderBottomRightRadius: 6 }
            : {
                backgroundColor: "#FFFFFF",
                color: INK,
                border: `1px solid ${GOLD}33`,
                borderBottomLeftRadius: 6,
              }
        }
      >
        {text}
      </div>
    </div>
  );
}
