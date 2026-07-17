import { useMemo } from "react";
import { Palette, Type, Square, Layout, RotateCcw, Check } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Card, Field, Input, Select, Switch } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { SERIF_FONTS, SANS_FONTS, ensureFontLoaded, findFont } from "@/lib/fontOptions";
import type { ThemeSettings } from "@/types/cms";
import { cn } from "@/utils/cn";

// ---------------------------------------------------------------------------
// Preset palettes — one-click looks the owner can apply.
// ---------------------------------------------------------------------------
const PRESET_PALETTES: { name: string; colors: ThemeSettings["colors"] }[] = [
  {
    name: "Marina (default)",
    colors: {
      accent: "#C6A15B", accentHover: "#B8924B",
      background: "#FAF6EF", surface: "#FFFFFF", text: "#26221C",
      darkBg: "#1B1812", darkAlt: "#141210", darkText: "#F5EFE2",
    },
  },
  {
    name: "Ocean Blue",
    colors: {
      accent: "#3E7CB1", accentHover: "#316095",
      background: "#F5F7FA", surface: "#FFFFFF", text: "#1E293B",
      darkBg: "#0F2540", darkAlt: "#0A1B30", darkText: "#E7EFF7",
    },
  },
  {
    name: "Sage Retreat",
    colors: {
      accent: "#8AA282", accentHover: "#6E866A",
      background: "#F4F1EA", surface: "#FFFFFF", text: "#2A2E27",
      darkBg: "#1F2A22", darkAlt: "#151E18", darkText: "#EDEFE8",
    },
  },
  {
    name: "Terracotta",
    colors: {
      accent: "#C86D4A", accentHover: "#A75A3B",
      background: "#FAF3EB", surface: "#FFFFFF", text: "#2D2019",
      darkBg: "#241812", darkAlt: "#1A100C", darkText: "#F4E9DE",
    },
  },
  {
    name: "Midnight Mono",
    colors: {
      accent: "#D4B896", accentHover: "#C4A683",
      background: "#F5F5F4", surface: "#FFFFFF", text: "#1C1917",
      darkBg: "#0C0A09", darkAlt: "#050403", darkText: "#F5F5F4",
    },
  },
];

const RADIUS_LABELS = {
  full: "Pill (fully rounded)",
  lg: "Large rounded",
  md: "Medium rounded",
  sm: "Small rounded",
};

const SPACING_LABELS = {
  compact: "Compact — tighter sections",
  normal: "Normal — balanced",
  spacious: "Spacious — airier",
};

export default function AppearanceManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const theme = data.settings.theme;

  const patch = (fn: (t: ThemeSettings) => ThemeSettings) =>
    update((d) => ({ ...d, settings: { ...d.settings, theme: fn(d.settings.theme) } }));

  const setColor = (key: keyof ThemeSettings["colors"], value: string) =>
    patch((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));

  const setFont = (kind: "serif" | "sans", name: string) => {
    const opt = findFont(name);
    if (opt) ensureFontLoaded(opt);
    patch((t) => ({ ...t, fonts: { ...t.fonts, [kind]: name } }));
    notify(`${kind === "serif" ? "Heading" : "Body"} font set to ${name}`);
  };

  const applyPreset = (preset: (typeof PRESET_PALETTES)[number]) => {
    patch((t) => ({ ...t, colors: preset.colors }));
    notify(`Applied "${preset.name}" palette`);
  };

  const resetTheme = () => {
    if (!window.confirm("Reset all appearance settings to defaults?")) return;
    patch(() => ({
      fonts: { serif: "Fraunces", sans: "Inter" },
      colors: PRESET_PALETTES[0].colors,
      buttons: { radius: "full", scale: 1 },
      ui: { animations: true, sectionSpacing: "normal" },
    }));
    notify("Appearance reset to defaults");
  };

  const buttonPreview = useMemo(
    () => ({
      padding: `${0.9 * theme.buttons.scale}rem ${1.75 * theme.buttons.scale}rem`,
      borderRadius:
        theme.buttons.radius === "full" ? "9999px" :
        theme.buttons.radius === "lg" ? "0.75rem" :
        theme.buttons.radius === "md" ? "0.5rem" : "0.25rem",
    }),
    [theme.buttons]
  );

  return (
    <div>
      <PageHeader
        title="Appearance"
        description="Control the fonts, color palette, button styling and interface behavior. Changes apply to the entire live site instantly."
        actions={
          <button
            onClick={resetTheme}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#26221C]/15 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#26221C]/60 hover:border-red-200 hover:text-red-500"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        }
      />

      {/* ---- Preset palettes ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Preset Palettes</p>
        </div>
        <p className="mb-5 text-sm text-[#26221C]/55">
          One-click palette presets. You can still fine-tune every color below.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PRESET_PALETTES.map((preset) => {
            const active = preset.colors.accent === theme.colors.accent && preset.colors.background === theme.colors.background;
            return (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl border p-1.5 text-left transition",
                  active ? "border-[#C6A15B] ring-2 ring-[#C6A15B]/30" : "border-[#26221C]/10 hover:border-[#C6A15B]/40"
                )}
              >
                <div className="flex h-16 overflow-hidden rounded-lg">
                  <div className="flex-1" style={{ background: preset.colors.background }} />
                  <div className="flex-1" style={{ background: preset.colors.accent }} />
                  <div className="flex-1" style={{ background: preset.colors.darkBg }} />
                </div>
                <div className="mt-2 flex items-center justify-between px-1 pb-1">
                  <span className="text-xs font-medium text-[#26221C]">{preset.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-[#C6A15B]" />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ---- Individual colors ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Custom Colors</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField label="Accent (buttons, icons)" value={theme.colors.accent} onChange={(v) => setColor("accent", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Accent Hover" value={theme.colors.accentHover} onChange={(v) => setColor("accentHover", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Page Background" value={theme.colors.background} onChange={(v) => setColor("background", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Card / Surface" value={theme.colors.surface} onChange={(v) => setColor("surface", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Text (charcoal)" value={theme.colors.text} onChange={(v) => setColor("text", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Dark Section BG" value={theme.colors.darkBg} onChange={(v) => setColor("darkBg", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Dark Alt (footer)" value={theme.colors.darkAlt} onChange={(v) => setColor("darkAlt", v)} onCommit={() => notify("Color saved")} />
          <ColorField label="Text on Dark" value={theme.colors.darkText} onChange={(v) => setColor("darkText", v)} onCommit={() => notify("Color saved")} />
        </div>
      </Card>

      {/* ---- Fonts ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Type className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Typography</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Heading Font (serif / display)">
            <Select value={theme.fonts.serif} onChange={(e) => setFont("serif", e.target.value)}>
              {SERIF_FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </Select>
            <div className="mt-3 rounded-lg bg-[#FAF6EF] px-4 py-4 space-y-1">
              <p
                className="text-4xl leading-tight text-[#26221C]"
                style={{ fontFamily: `"${theme.fonts.serif}", serif`, letterSpacing: "-0.02em" }}
              >
                Your Ocean-View Office in Palawan.
              </p>
              <p
                className="text-lg leading-tight text-[#26221C]/50"
                style={{ fontFamily: `"${theme.fonts.serif}", serif`, fontStyle: "italic", letterSpacing: "-0.01em" }}
              >
                Deep work. Real connections.
              </p>
            </div>
          </Field>
          <Field label="Body Font (sans)">
            <Select value={theme.fonts.sans} onChange={(e) => setFont("sans", e.target.value)}>
              {SANS_FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </Select>
            <div className="mt-3 space-y-2 rounded-lg bg-[#FAF6EF] px-4 py-4">
              <p
                className="text-sm font-medium leading-relaxed text-[#26221C]"
                style={{ fontFamily: `"${theme.fonts.sans}", sans-serif` }}
              >
                Deep work, Starlink internet, open-air rooftop workspace, premium guest kitchen and boutique long-stay suites — designed for remote workers.
              </p>
              <p
                className="text-xs uppercase tracking-widest text-[#C6A15B]"
                style={{ fontFamily: `"${theme.fonts.sans}", sans-serif` }}
              >
                Poblacion, San Vicente, Palawan
              </p>
            </div>
          </Field>
        </div>
      </Card>

      {/* ---- Buttons ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Square className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Buttons</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Corner Style">
            <Select
              value={theme.buttons.radius}
              onChange={(e) => { patch((t) => ({ ...t, buttons: { ...t.buttons, radius: e.target.value as ThemeSettings["buttons"]["radius"] } })); notify("Button style saved"); }}
            >
              {Object.entries(RADIUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label={`Size Scale — ${Math.round(theme.buttons.scale * 100)}%`} hint="Multiplier for button padding (85%–125%)">
            <input
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              value={theme.buttons.scale}
              onChange={(e) => patch((t) => ({ ...t, buttons: { ...t.buttons, scale: parseFloat(e.target.value) } }))}
              onMouseUp={() => notify("Button size saved")}
              onTouchEnd={() => notify("Button size saved")}
              className="w-full accent-[#C6A15B]"
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 rounded-xl bg-[#FAF6EF] p-4">
          <span className="mb-1 w-full text-xs font-medium uppercase tracking-wide text-[#26221C]/50">Live Preview</span>
          <button
            style={{ ...buttonPreview, background: theme.colors.accent, color: theme.colors.darkBg }}
            className="text-sm font-medium uppercase tracking-wide"
          >
            Primary Button
          </button>
          <button
            style={{ ...buttonPreview, background: theme.colors.darkBg, color: theme.colors.darkText }}
            className="text-sm font-medium uppercase tracking-wide"
          >
            Secondary Button
          </button>
          <button
            style={{ ...buttonPreview, background: "transparent", color: theme.colors.text, border: `1px solid ${theme.colors.text}30` }}
            className="text-sm font-medium uppercase tracking-wide"
          >
            Outline Button
          </button>
        </div>
      </Card>

      {/* ---- Interface behavior ---- */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Layout className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Interface</p>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-lg bg-[#FAF6EF] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#26221C]">Motion Animations</p>
              <p className="text-xs text-[#26221C]/50">Scroll-in reveals, hover effects, and page transitions.</p>
            </div>
            <Switch
              checked={theme.ui.animations}
              onChange={(v) => { patch((t) => ({ ...t, ui: { ...t.ui, animations: v } })); notify(v ? "Animations enabled" : "Animations disabled"); }}
            />
          </label>
          <Field label="Section Spacing">
            <Select
              value={theme.ui.sectionSpacing}
              onChange={(e) => { patch((t) => ({ ...t, ui: { ...t.ui, sectionSpacing: e.target.value as ThemeSettings["ui"]["sectionSpacing"] } })); notify("Spacing updated"); }}
            >
              {Object.entries(SPACING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color field with paired swatch + hex input
// ---------------------------------------------------------------------------
function ColorField({
  label, value, onChange, onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#26221C]/50">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-[#26221C]/15"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} className="font-mono text-sm" />
      </div>
    </div>
  );
}
