import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Select, Switch, Badge } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import {
  fetchOpenRouterModels,
  formatPrice,
  type OpenRouterModel,
} from "../shared/openRouterModels";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import type { CmsData, TalaSettings } from "@/types/cms";

// ---------------------------------------------------------------------------
// TALA settings — admin picks the OpenRouter model AND (for fast iteration
// while building) can paste an API key straight in here.
//
// Trade-off, stated plainly: this page's data is the same data the public
// site loads to render itself, so anything saved here — including this key
// — is technically readable by anyone who inspects the site's network
// requests. That's the same pattern this codebase already uses for the
// WhatsApp chatbot's API key field (see WhatsAppManager.tsx), so it's not a
// new risk class, just the same one applied to TALA. Fine for a key you're
// fine rotating during active building; swap it for the private Supabase
// Edge Function secret (never exposed) before this is production-final.
// ---------------------------------------------------------------------------

type SyncState = "idle" | "saving" | "verifying" | "synced" | "error";

const DB_ROW_KEY = "marina_terrace_payload";

export default function TalaManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const tala = data.settings.tala;

  const [models, setModels] = useState<{ free: OpenRouterModel[]; paid: OpenRouterModel[] } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [sync, setSync] = useState<SyncState>("idle");
  const [keyInput, setKeyInput] = useState(tala.apiKey);
  const [showKey, setShowKey] = useState(false);

  const loadModels = async () => {
    setLoadingModels(true);
    setLoadError(null);
    try {
      const result = await fetchOpenRouterModels();
      setModels(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not reach OpenRouter's model list right now.",
      );
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, []);

  const allModels = useMemo(() => [...(models?.free ?? []), ...(models?.paid ?? [])], [models]);
  const selected = allModels.find((m) => m.id === tala.modelId) ?? null;

  const patchTala = (fn: (t: TalaSettings) => TalaSettings) =>
    update((d) => ({ ...d, settings: { ...d.settings, tala: fn(d.settings.tala) } }));

  const chooseModel = async (modelId: string) => {
    if (!modelId) {
      patchTala((t) => ({
        ...t,
        modelId: "",
        modelLabel: "",
        isFreeModel: true,
        updatedAt: new Date().toISOString(),
      }));
      notify("Reverted to the built-in free-model fallback chain");
      return;
    }
    const model = allModels.find((m) => m.id === modelId);
    if (!model) return;

    const nextTala: TalaSettings = {
      ...tala,
      modelId: model.id,
      modelLabel: model.name,
      isFreeModel: model.isFree,
      updatedAt: new Date().toISOString(),
    };
    patchTala(() => nextTala);
    notify(`TALA model set to ${model.name}`);

    // Confirm the choice actually round-tripped to Supabase (the "green light").
    setSync("saving");
    await new Promise((r) => setTimeout(r, 500)); // let CmsContext's debounced save fire
    setSync("verifying");
    try {
      if (isSupabaseConnected() && supabase) {
        const { data: row, error } = await supabase
          .from("cms_data")
          .select("value")
          .eq("key", DB_ROW_KEY)
          .maybeSingle();
        const cloudModelId = (row?.value as Partial<CmsData> | undefined)?.settings?.tala?.modelId;
        if (!error && cloudModelId === nextTala.modelId) {
          setSync("synced");
        } else {
          setSync("error");
        }
      } else {
        setSync("synced"); // localStorage-only mode: save() completing is the whole story
      }
    } catch {
      setSync("error");
    }
  };

  const toggleEnabled = (on: boolean) => {
    patchTala((t) => ({ ...t, enabled: on, updatedAt: new Date().toISOString() }));
    notify(on ? "TALA enabled on the site" : "TALA hidden from the site");
  };

  const saveKey = () => {
    const trimmed = keyInput.trim();
    patchTala((t) => ({ ...t, apiKey: trimmed, updatedAt: new Date().toISOString() }));
    notify(trimmed ? "API key saved — TALA is live" : "API key cleared");
  };

  return (
    <div>
      <PageHeader
        title="TALA — AI Voice Concierge"
        description="Pick which AI model powers TALA's answers. The voice itself (Kokoro, in-browser) is separate and always free."
      />

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F3D2B]/10">
              <Sparkles className="h-5 w-5 text-[#1F3D2B]" />
            </div>
            <div>
              <p className="font-serif text-lg text-[#26221C]">Show TALA on the site</p>
              <p className="text-xs text-[#26221C]/50">
                Turns the floating chat widget on or off for every visitor.
              </p>
            </div>
          </div>
          <Switch checked={tala.enabled} onChange={toggleEnabled} />
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">OpenRouter API Key</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              Paste your key here to make TALA work right now, no deploy step needed. Fast for
              building — see the note below on why this isn't where a final production key should
              live.
            </p>
          </div>
          <Badge
            className={tala.apiKey ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}
          >
            {tala.apiKey ? "Key set — TALA is live" : "No key yet"}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="API Key">
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-or-v1-…"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#26221C]/40 hover:text-[#26221C]"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>
          <Button onClick={saveKey} disabled={keyInput === tala.apiKey}>
            Save Key
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Model</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              All current OpenRouter models, free and paid, A–Z. Free models cost nothing to run;
              paid models are billed to your OpenRouter account per use.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadModels} disabled={loadingModels}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loadError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        <Field
          label="Active model"
          hint="Leave on the default to let TALA automatically use free models with fallback."
        >
          <Select
            value={tala.modelId}
            onChange={(e) => void chooseModel(e.target.value)}
            disabled={loadingModels}
          >
            <option value="">— Default: automatic free-model fallback —</option>
            {models && models.free.length > 0 && (
              <optgroup label={`Free models (${models.free.length})`}>
                {models.free.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
            {models && models.paid.length > 0 && (
              <optgroup label={`Paid models (${models.paid.length})`}>
                {models.paid.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatPrice(m)}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {selected && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-[#FAF6EF] px-4 py-3 text-sm">
            <Badge
              className={
                selected.isFree ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }
            >
              {selected.isFree ? "Free" : "Paid"}
            </Badge>
            <span className="text-[#26221C]/70">{selected.id}</span>
            {!selected.isFree && (
              <span className="text-[#26221C]/50">· {formatPrice(selected)}</span>
            )}
            {selected.contextLength && (
              <span className="text-[#26221C]/50">
                · {selected.contextLength.toLocaleString()} token context
              </span>
            )}
          </div>
        )}

        {/* Sync indicator — the "green light" */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {sync === "idle" && (
            <span className="text-[#26221C]/40">No changes yet this session.</span>
          )}
          {sync === "saving" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#26221C]/50" />
              <span className="text-[#26221C]/60">Saving…</span>
            </>
          )}
          {sync === "verifying" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#26221C]/50" />
              <span className="text-[#26221C]/60">Confirming it reached the live site…</span>
            </>
          )}
          {sync === "synced" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-700">
                Synced — TALA on the live site is now using this model.
              </span>
            </>
          )}
          {sync === "error" && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">
                Saved locally, but couldn't confirm the cloud copy. Refresh this page to check
                again.
              </span>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-2 text-sm text-[#26221C]/70">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-[#26221C]">Good for building, not for launch day</p>
            <p className="mt-1">
              The key above is stored in the same data the public site loads to render itself —
              which means, technically, anyone who opens their browser's network tab while visiting
              the site could read it. That's an acceptable trade while you're iterating fast and can
              rotate the key anytime. Before this goes fully public, move it to a private Supabase
              Edge Function secret (
              <code className="rounded bg-[#26221C]/5 px-1.5 py-0.5 text-xs">
                OPENROUTER_API_KEY
              </code>
              ) instead — same model picker above, key never exposed. One command when you're ready:{" "}
              <code className="rounded bg-[#26221C]/5 px-1.5 py-0.5 text-xs">
                supabase secrets set OPENROUTER_API_KEY=...
              </code>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
