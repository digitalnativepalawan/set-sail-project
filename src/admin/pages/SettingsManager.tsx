import { useState } from "react";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Switch } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";

export default function SettingsManager() {
  const { data, update, resetAll } = useCms();
  const { changePasskey } = useAuth();
  const { notify } = useToast();
  const [newPasskey, setNewPasskey] = useState("");

  const s = data.settings;
  const patch = (fn: (d: typeof s) => typeof s) => update((d) => ({ ...d, settings: fn(d.settings) }));

  const savePasskey = () => {
    if (newPasskey.trim().length < 4) {
      notify("Passkey should be at least 4 characters", "info");
      return;
    }
    changePasskey(newPasskey.trim());
    setNewPasskey("");
    notify("Admin passkey updated");
  };

  const handleReset = async () => {
    if (window.confirm("This will reset ALL website content back to defaults. Continue?")) {
      await resetAll();
      notify("Content reset to defaults");
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="General site settings, appearance defaults, and admin access controls." />

      <Card className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Site Name">
            <Input value={s.siteName} onChange={(e) => patch((d) => ({ ...d, siteName: e.target.value }))} onBlur={() => notify("Settings updated")} />
          </Field>
          <Field label="Logo Text (navbar)">
            <Input value={s.logoText} onChange={(e) => patch((d) => ({ ...d, logoText: e.target.value }))} onBlur={() => notify("Settings updated")} />
          </Field>
          <Field label="Tagline">
            <Input value={s.tagline} onChange={(e) => patch((d) => ({ ...d, tagline: e.target.value }))} onBlur={() => notify("Settings updated")} />
          </Field>
          <Field label="Accent Color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={s.accentColor}
                onChange={(e) => patch((d) => ({ ...d, accentColor: e.target.value }))}
                className="h-10 w-14 cursor-pointer rounded-lg border border-[#26221C]/15"
              />
              <Input value={s.accentColor} onChange={(e) => patch((d) => ({ ...d, accentColor: e.target.value }))} onBlur={() => notify("Accent color updated")} />
            </div>
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm text-[#26221C]/70">
          <Switch checked={s.darkModeDefault} onChange={(v) => { patch((d) => ({ ...d, darkModeDefault: v })); notify("Setting updated"); }} />
          Default admin dashboard to dark mode
        </label>
      </Card>

      <Card className="mt-6 space-y-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C6A15B]" />
          <div>
            <p className="font-serif text-lg text-[#26221C]">Admin Access</p>
            <p className="text-sm text-[#26221C]/55">
              Update the temporary passkey below. For production, replace this passkey system with Supabase Auth —
              the authentication logic is isolated in <code className="rounded bg-[#26221C]/5 px-1">src/context/AuthContext.tsx</code> and{" "}
              <code className="rounded bg-[#26221C]/5 px-1">src/lib/storage.ts</code> for an easy swap.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="New Passkey">
            <Input value={newPasskey} onChange={(e) => setNewPasskey(e.target.value)} placeholder="Enter new passkey" />
          </Field>
          <Button onClick={savePasskey}>Update Passkey</Button>
        </div>
      </Card>

      <Card className="mt-6 flex items-center justify-between p-6">
        <div>
          <p className="font-serif text-lg text-[#26221C]">Danger Zone</p>
          <p className="text-sm text-[#26221C]/55">Reset all website content back to the original defaults.</p>
        </div>
        <Button variant="danger" onClick={handleReset}><RotateCcw className="h-4 w-4" /> Reset All Content</Button>
      </Card>
    </div>
  );
}
