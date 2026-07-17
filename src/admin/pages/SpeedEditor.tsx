import { useState } from "react";
import { Zap, Loader2, CheckCircle2, ArrowDown, ArrowUp, Radio, Satellite, ShieldCheck, Info } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { runSpeedTest } from "@/lib/speedtest";
import { formatDate } from "../ops/opsUtils";

export default function SpeedEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const s = data.homepage.speed;
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState("");

  const patch = (fn: (d: typeof s) => typeof s) =>
    update((d) => ({ ...d, homepage: { ...d.homepage, speed: fn(d.homepage.speed) } }));

  const measureAndSave = async () => {
    setTesting(true);
    setProgress(0);
    setStatus("Pinging…");
    try {
      const result = await runSpeedTest((p) => {
        setProgress(p.progress);
        setStatus(`Measuring… ${p.downloadMbps.toFixed(1)} Mbps`);
      });
      patch((d) => ({
        ...d,
        downloadMbps: result.downloadMbps,
        uploadMbps: result.uploadMbps,
        pingMs: result.pingMs,
        lastMeasuredAt: new Date().toISOString(),
      }));
      setStatus("Done");
      notify(`Baseline updated: ${result.downloadMbps.toFixed(1)} Mbps down`);
    } catch {
      setStatus("Measurement failed");
      notify("Could not run speed test — check your connection", "info");
    } finally {
      setTimeout(() => { setTesting(false); setStatus(""); setProgress(0); }, 800);
    }
  };

  return (
    <div>
      <PageHeader
        title="Internet Speed"
        description="Configure the live speed section shown on the homepage. Run a test right now to lock in the current baseline values."
      />

      {/* --- Live test panel --- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-serif text-lg text-[#26221C]">
              <Zap className="h-4 w-4 text-[#C6A15B]" />
              Run a Live Speed Test
            </p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              This measures from <strong>this device</strong> right now. For best results,
              open the admin from a laptop connected to your Starlink at Marina Terrace.
            </p>
          </div>
          <Button onClick={measureAndSave} disabled={testing}>
            {testing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Testing…</>
            ) : (
              <><Zap className="h-4 w-4" /> Test &amp; Save</>
            )}
          </Button>
        </div>

        {testing && (
          <div className="rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[#26221C]/60">
              <span>{status}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#26221C]/10">
              <div
                className="h-full bg-[#C6A15B] transition-all duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {s.lastMeasuredAt && !testing && (
          <p className="flex items-center gap-1.5 text-xs text-[#26221C]/50">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Last measured: {formatDate(s.lastMeasuredAt)}
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <ReadoutCard icon={<ArrowDown className="h-3.5 w-3.5" />} label="Download" value={s.downloadMbps.toFixed(1)} unit="Mbps" tone="gold" />
          <ReadoutCard icon={<ArrowUp className="h-3.5 w-3.5" />} label="Upload" value={s.uploadMbps.toFixed(1)} unit="Mbps" />
          <ReadoutCard icon={<Radio className="h-3.5 w-3.5" />} label="Ping" value={s.pingMs.toFixed(0)} unit="ms" />
        </div>
      </Card>

      {/* --- Section content --- */}
      <Card className="mb-6 space-y-5 p-6">
        <p className="font-serif text-lg text-[#26221C]">Section Copy</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow"><Input value={s.eyebrow} onChange={(e) => patch((d) => ({ ...d, eyebrow: e.target.value }))} onBlur={() => notify("Saved")} /></Field>
          <Field label="Section Title"><Input value={s.title} onChange={(e) => patch((d) => ({ ...d, title: e.target.value }))} onBlur={() => notify("Saved")} /></Field>
        </div>
        <Field label="Paragraph"><Textarea rows={3} value={s.paragraph} onChange={(e) => patch((d) => ({ ...d, paragraph: e.target.value }))} onBlur={() => notify("Saved")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider Label"><Input value={s.provider} onChange={(e) => patch((d) => ({ ...d, provider: e.target.value }))} onBlur={() => notify("Saved")} placeholder="e.g. Starlink Business" /></Field>
          <Field label="Location Label"><Input value={s.location} onChange={(e) => patch((d) => ({ ...d, location: e.target.value }))} onBlur={() => notify("Saved")} /></Field>
        </div>
      </Card>

      {/* --- Connection / ISP settings — the stuff that changes over time --- */}
      <Card className="mb-6 space-y-5 p-6">
        <div className="flex items-start gap-2">
          <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
          <div>
            <p className="font-serif text-lg text-[#26221C]">Connection Settings</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              Update these whenever your plan, provider, or redundancy setup changes —
              e.g. upgrading Starlink tiers, adding a second dish, or switching failover carriers.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan / Service Tier" hint="e.g. Starlink Business, Starlink Roam">
            <Input value={s.planName} onChange={(e) => patch((d) => ({ ...d, planName: e.target.value }))} onBlur={() => notify("Saved")} />
          </Field>
          <Field label="Number of Dishes" hint="For redundancy — 2 dishes = automatic failover between them">
            <Input type="number" min={1} value={s.dishCount} onChange={(e) => patch((d) => ({ ...d, dishCount: parseInt(e.target.value) || 1 }))} onBlur={() => notify("Saved")} />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-lg bg-[#FAF6EF] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" />
            <div>
              <p className="text-sm font-medium text-[#26221C]">Show Failover Badge on Site</p>
              <p className="text-xs text-[#26221C]/50">Displays a redundancy badge under the provider strip.</p>
            </div>
          </div>
          <Switch
            checked={s.hasFailover}
            onChange={(v) => { patch((d) => ({ ...d, hasFailover: v })); notify(v ? "Failover badge shown" : "Failover badge hidden"); }}
          />
        </label>

        {s.hasFailover && (
          <div className="grid gap-4 rounded-lg border border-[#26221C]/10 p-4 sm:grid-cols-2">
            <Field label="Failover Provider" hint="e.g. Smart 5G, Globe LTE">
              <Input value={s.failoverProvider} onChange={(e) => patch((d) => ({ ...d, failoverProvider: e.target.value }))} onBlur={() => notify("Saved")} />
            </Field>
            <Field label="Failover Connection Type" hint="e.g. 5G, 4G/LTE, Secondary Starlink">
              <Input value={s.failoverType} onChange={(e) => patch((d) => ({ ...d, failoverType: e.target.value }))} onBlur={() => notify("Saved")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Redundancy Note" hint="Shown as supporting copy on the site, e.g. switch time">
                <Input value={s.redundancyNote} onChange={(e) => patch((d) => ({ ...d, redundancyNote: e.target.value }))} onBlur={() => notify("Saved")} />
              </Field>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account / Kit Reference" hint="Internal only — never shown on the site">
            <Input value={s.accountReference} onChange={(e) => patch((d) => ({ ...d, accountReference: e.target.value }))} onBlur={() => notify("Saved")} placeholder="e.g. Kit #KIT-00123" />
          </Field>
          <Field label="ISP Support Contact" hint="Internal only — for your own quick reference">
            <Input value={s.supportContact} onChange={(e) => patch((d) => ({ ...d, supportContact: e.target.value }))} onBlur={() => notify("Saved")} placeholder="e.g. support@starlink.com" />
          </Field>
        </div>

        <Field label="Provider Notes" hint="Private admin notes — plan changes, outage history, install dates, etc.">
          <Textarea rows={2} value={s.providerNotes} onChange={(e) => patch((d) => ({ ...d, providerNotes: e.target.value }))} onBlur={() => notify("Saved")} />
        </Field>

        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900/80">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Account reference, support contact and provider notes are private — they never appear on the public website.</p>
        </div>
      </Card>

      {/* --- Manual override --- */}
      <Card className="mb-6 space-y-5 p-6">
        <div>
          <p className="font-serif text-lg text-[#26221C]">Baseline Values</p>
          <p className="mt-1 text-sm text-[#26221C]/55">
            Values shown when no live test runs (or when it fails). Best practice:
            run the live test above to auto-populate these.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Download (Mbps)">
            <Input type="number" value={s.downloadMbps} onChange={(e) => patch((d) => ({ ...d, downloadMbps: parseFloat(e.target.value) || 0 }))} onBlur={() => notify("Saved")} />
          </Field>
          <Field label="Upload (Mbps)">
            <Input type="number" value={s.uploadMbps} onChange={(e) => patch((d) => ({ ...d, uploadMbps: parseFloat(e.target.value) || 0 }))} onBlur={() => notify("Saved")} />
          </Field>
          <Field label="Ping (ms)">
            <Input type="number" value={s.pingMs} onChange={(e) => patch((d) => ({ ...d, pingMs: parseFloat(e.target.value) || 0 }))} onBlur={() => notify("Saved")} />
          </Field>
        </div>
      </Card>

      {/* --- Behavior toggle --- */}
      <Card className="p-6">
        <label className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Live test on the site</p>
            <p className="mt-1 max-w-xl text-sm text-[#26221C]/55">
              When enabled, every visitor's browser will run a real speed test on their own
              connection. This showcases real performance, but the visitor's number reflects
              <em> their own</em> network, not just Starlink — great for proving reliability,
              or turn off to always show your latest measured baseline instead.
            </p>
          </div>
          <Switch
            checked={s.liveTest}
            onChange={(v) => { patch((d) => ({ ...d, liveTest: v })); notify(v ? "Live test enabled" : "Live test disabled"); }}
          />
        </label>
      </Card>
    </div>
  );
}

function ReadoutCard({
  icon, label, value, unit, tone = "default",
}: { icon: React.ReactNode; label: string; value: string; unit: string; tone?: "default" | "gold" }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${
      tone === "gold" ? "border-[#C6A15B]/30 bg-[#C6A15B]/5" : "border-[#26221C]/10 bg-[#FAF6EF]"
    }`}>
      <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full ${
        tone === "gold" ? "bg-[#C6A15B]/20 text-[#C6A15B]" : "bg-[#26221C]/10 text-[#26221C]/60"
      }`}>{icon}</div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#26221C]/45">{label}</p>
      <p className="font-serif text-xl text-[#26221C]">{value}</p>
      <p className="text-[10px] text-[#26221C]/40">{unit}</p>
    </div>
  );
}
