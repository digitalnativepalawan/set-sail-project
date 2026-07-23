import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  Circle,
  ClipboardList,
  Lightbulb,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader, TabBar } from "../shared/PageHeader";
import { useTalaChat } from "@/components/tala/useTalaChat";
import { buildTalaSystemPrompt } from "@/components/tala/talaPersona";
import { computeBriefing } from "@/components/tala/buildTalaBriefing";
import {
  addTalaBriefing,
  addTalaGoal,
  addTalaTask,
  addTalaWin,
  fetchTalaBriefings,
  fetchTalaGoals,
  fetchTalaTasks,
  fetchTalaWins,
  generateTalaBriefing,
  type TalaBriefing,
  type TalaGoal,
  type TalaTask,
  type TalaWin,
} from "@/components/tala/talaOps";

type Tab = "chat" | "briefing" | "goals" | "tasks" | "wins";

export default function TalaOps() {
  const { data } = useCms();
  const { notify } = useToast();
  const tala = useTalaChat();
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div>
      <PageHeader
        title="TALA — Operations Console"
        description="Talk to TALA as the operator, read her morning briefings, and track her goals, weekly tasks and wins. The guest orb on the site is separate — this is the team's back-office window into TALA."
      />
      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "chat", label: "Chat" },
          { id: "briefing", label: "Morning Brief" },
          { id: "goals", label: "Goals" },
          { id: "tasks", label: "Tasks" },
          { id: "wins", label: "Wins" },
        ]}
      />
      {tab === "chat" && <ChatTab tala={tala} cms={data} notify={notify} />}
      {tab === "briefing" && <BriefingTab cms={data} notify={notify} />}
      {tab === "goals" && <GoalsTab notify={notify} />}
      {tab === "tasks" && <TasksTab notify={notify} />}
      {tab === "wins" && <WinsTab cms={data} notify={notify} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CHAT — operator face. Same brain as the guest orb (useTalaChat -> tala-chat
// edge function or admin/api key). Different system prompt: she is reporting to
// the owner/team, can reference ops, and is allowed to be more direct.
// ---------------------------------------------------------------------------
function operatorPrompt(siteName: string): string {
  return [
    `You are TALA, the AI operations concierge for ${siteName} in San Vicente, Palawan.`,
    `You are speaking with the OWNER or STAFF (not a guest). Be direct, concise and useful.`,
    `You can reference bookings, tours, staff, payments and tasks. When asked for a morning update, give a tight rundown of today's arrivals, departures, tours, bikes out, in-house guests, and any unpaid payroll or money notes.`,
    `Never invent numbers — use what is in context. If you don't know, say so. Keep replies to 1-4 sentences unless detail is asked for.`,
  ].join("\n");
}

function ChatTab({
  tala,
  cms,
  notify,
}: {
  tala: ReturnType<typeof useTalaChat>;
  cms: import("@/types/cms").CmsData;
  notify: ReturnType<typeof useToast>["notify"];
}) {
  const [draft, setDraft] = useState("");
  const siteName = cms.settings.siteName || "Marina Terrace";
  const modelId = cms.settings.tala.modelId || undefined;
  const adminKey = cms.settings.tala.apiKey?.trim() || undefined;

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await tala.send(text, operatorPrompt(siteName), {
      model: modelId,
      adminApiKey: adminKey,
      cms,
    });
  }, [draft, tala, siteName, modelId, adminKey, cms]);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-4 w-4 text-[#C6A15B]" />
        <p className="font-serif text-lg text-[#26221C]">Talk to TALA</p>
      </div>
      <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-lg bg-[#FAF6EF] p-4">
        {tala.messages.length === 0 && (
          <p className="text-sm text-[#26221C]/45">
            Ask TALA for today's rundown, "what needs my attention?", or "summarise
            this week's bookings". She uses the same brain as the guest orb.
          </p>
        )}
        {tala.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#26221C] text-white"
                  : "bg-white text-[#26221C] shadow-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {tala.thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm text-[#26221C]/60 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C6A15B]" />
              TALA is thinking…
            </div>
          </div>
        )}
      </div>
      {tala.error && (
        <p className="mb-3 text-xs text-red-500">{tala.error}</p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message TALA as the operator…"
          className="min-h-[52px]"
        />
        <Button onClick={send} disabled={tala.thinking || !draft.trim()}>
          <Send className="h-4 w-4" /> Send
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-[#26221C]/40">
        Brain: Admin → TALA model {modelId ? `(${modelId})` : "(free fallback)"}.
        If chat is blank/erroring, set the model + API key in Admin → TALA, or
        ensure the tala-chat edge function secret is set.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MORNING BRIEF — computed live from ops data, stored as a briefing row.
// ---------------------------------------------------------------------------
function BriefingTab({
  cms,
  notify,
}: {
  cms: import("@/types/cms").CmsData;
  notify: ReturnType<typeof useToast>["notify"];
}) {
  const [briefings, setBriefings] = useState<TalaBriefing[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    fetchTalaBriefings().then(setBriefings);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true);
    // Prefer the server-side SQL function (same logic as the daily cron).
    let saved = await generateTalaBriefing();
    // Fallback: if the RPC isn't deployed yet, compute in-browser + insert.
    if (!saved) {
      const snap = computeBriefing(cms);
      saved = await addTalaBriefing({
        brief_date: snap.briefDate,
        summary: snap.summary,
        highlights: snap.highlights,
      });
    }
    setGenerating(false);
    if (saved) {
      notify("Morning briefing saved.", "success");
      load();
    } else {
      notify("Could not save briefing (Supabase not connected?).", "error");
    }
  }, [cms, notify, load]);

  return (
    <div>
      <Card className="mb-6 p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#C6A15B]" />
            <p className="font-serif text-lg text-[#26221C]">This morning's brief</p>
          </div>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate briefing
          </Button>
        </div>
        {briefings && briefings.length > 0 ? (
          <div className="rounded-lg bg-[#FAF6EF] p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#26221C]/45">
              {briefings[0].brief_date}
            </p>
            <p className="text-sm leading-relaxed text-[#26221C]">
              {briefings[0].summary}
            </p>
            {briefings[0].highlights.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {briefings[0].highlights.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-white px-2.5 py-1 text-xs text-[#26221C]/70 shadow-sm"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#26221C]/45">
            No briefing yet. Click "Generate briefing" to compute today's rundown
            from live bookings, tours, staff and payments.
          </p>
        )}
      </Card>

      <Card className="p-6">
        <p className="mb-3 flex items-center gap-2 font-serif text-lg text-[#26221C]">
          <Brain className="h-4 w-4 text-[#C6A15B]" /> Briefing history
        </p>
        {briefings && briefings.length > 1 ? (
          <div className="space-y-3">
            {briefings.slice(1).map((b) => (
              <div key={b.id} className="rounded-lg border border-[#26221C]/10 p-3">
                <p className="mb-1 text-xs font-medium text-[#26221C]/45">{b.brief_date}</p>
                <p className="text-sm text-[#26221C]">{b.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#26221C]/45">Past briefings will appear here.</p>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GOALS — what TALA is working toward.
// ---------------------------------------------------------------------------
function GoalsTab({ notify }: { notify: ReturnType<typeof useToast>["notify"] }) {
  const [goals, setGoals] = useState<TalaGoal[] | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(() => fetchTalaGoals().then(setGoals), []);
  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async () => {
    if (!title.trim()) return;
    const row = await addTalaGoal({ title, description: desc });
    if (row) {
      setTitle("");
      setDesc("");
      notify("Goal added.", "success");
      load();
    } else notify("Could not save goal.", "error");
  }, [title, desc, notify, load]);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-[#C6A15B]" />
        <p className="font-serif text-lg text-[#26221C]">Goals</p>
      </div>
      <div className="mb-5 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
        <Field label="Goal title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fill 3 day-passes this week" />
        </Field>
        <Field label="Notes (optional)">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What success looks like" />
        </Field>
        <div className="flex items-end">
          <Button onClick={add} disabled={!title.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      {goals === null ? (
        <p className="text-sm text-[#26221C]/45">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-[#26221C]/45">No goals yet. Add TALA's first objective.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="flex items-start gap-3 rounded-lg border border-[#26221C]/10 p-3">
              {g.status === "done" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-[#C6A15B]" />
              )}
              <div>
                <p className={`text-sm font-medium ${g.status === "done" ? "text-[#26221C]/45 line-through" : "text-[#26221C]"}`}>
                  {g.title}
                </p>
                {g.description && (
                  <p className="text-xs text-[#26221C]/50">{g.description}</p>
                )}
                {g.target_date && (
                  <p className="text-[11px] text-[#26221C]/40">Target: {g.target_date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TASKS — weekly / one-off tasks TALA tracks.
// ---------------------------------------------------------------------------
function TasksTab({ notify }: { notify: ReturnType<typeof useToast>["notify"] }) {
  const [tasks, setTasks] = useState<TalaTask[] | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const load = useCallback(() => fetchTalaTasks().then(setTasks), []);
  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async () => {
    if (!title.trim()) return;
    const row = await addTalaTask({ title, due });
    if (row) {
      setTitle("");
      setDue("");
      notify("Task added.", "success");
      load();
    } else notify("Could not save task.", "error");
  }, [title, due, notify, load]);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#C6A15B]" />
        <p className="font-serif text-lg text-[#26221C]">Tasks</p>
      </div>
      <div className="mb-5 grid gap-2 md:grid-cols-[2fr_1fr_auto]">
        <Field label="Task">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Confirm 2pm airport pickup with Maria" />
        </Field>
        <Field label="Due (optional)">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button onClick={add} disabled={!title.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      {tasks === null ? (
        <p className="text-sm text-[#26221C]/45">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[#26221C]/45">No tasks yet. Add this week's to-dos.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-[#26221C]/10 p-3">
              {t.status === "done" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-[#C6A15B]" />
              )}
              <div>
                <p className={`text-sm font-medium ${t.status === "done" ? "text-[#26221C]/45 line-through" : "text-[#26221C]"}`}>
                  {t.title}
                </p>
                <p className="text-[11px] text-[#26221C]/40">
                  {t.category}
                  {t.due ? ` · due ${t.due}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// WINS — what TALA accomplished (logged manually now; auto later).
// ---------------------------------------------------------------------------
function WinsTab({
  cms,
  notify,
}: {
  cms: import("@/types/cms").CmsData;
  notify: ReturnType<typeof useToast>["notify"];
}) {
  const [wins, setWins] = useState<TalaWin[] | null>(null);
  const [text, setText] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => fetchTalaWins().then(setWins), []);
  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async () => {
    if (!text.trim()) return;
    const row = await addTalaWin({ brief_date: today, text });
    if (row) {
      setText("");
      notify("Win logged.", "success");
      load();
    } else notify("Could not save win.", "error");
  }, [text, today, notify, load]);

  // Reuse the brain to suggest a weekly summary if asked.
  const tala = useTalaChat();
  const [digest, setDigest] = useState<string | null>(null);

  const summarize = useCallback(async () => {
    const list = wins ?? [];
    if (list.length === 0) {
      notify("No wins to summarise yet.", "info");
      return;
    }
    const prompt = `Summarise these accomplishments TALA achieved this period in 2-3 short bullet-style sentences for the owner:\n${list
      .map((w) => `- ${w.text}`)
      .join("\n")}`;
    setDigest(null);
    const out = await tala.send(prompt, buildTalaSystemPrompt(cms), {
      model: cms.settings.tala.modelId || undefined,
      adminApiKey: cms.settings.tala.apiKey?.trim() || undefined,
      cms,
    });
    setDigest(out);
  }, [wins, tala, cms]);

  return (
    <div>
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Wins & accomplishments</p>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <Field label="What TALA accomplished">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Captured 4 qualified leads; flagged 2 unpaid departures" />
          </Field>
          <div className="flex items-end">
            <Button onClick={add} disabled={!text.trim()}>
              <Plus className="h-4 w-4" /> Log win
            </Button>
          </div>
        </div>
        <Button variant="outline" onClick={summarize} disabled={tala.thinking}>
          {tala.thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Summarise with TALA
        </Button>
        {digest && (
          <p className="mt-3 rounded-lg bg-[#FAF6EF] p-3 text-sm text-[#26221C]">{digest}</p>
        )}
      </Card>

      <Card className="p-6">
        <p className="mb-3 font-serif text-lg text-[#26221C]">Recent wins</p>
        {wins === null ? (
          <p className="text-sm text-[#26221C]/45">Loading…</p>
        ) : wins.length === 0 ? (
          <p className="text-sm text-[#26221C]/45">No wins logged yet.</p>
        ) : (
          <div className="space-y-3">
            {wins.map((w) => (
              <div key={w.id} className="rounded-lg border border-[#26221C]/10 p-3">
                <p className="text-xs text-[#26221C]/45">{w.brief_date}</p>
                <p className="text-sm text-[#26221C]">{w.text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
