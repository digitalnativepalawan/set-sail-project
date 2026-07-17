import { useEffect, type ReactNode } from "react";
import { useCms } from "./CmsContext";
import type { ThemeSettings } from "@/types/cms";
import { ensureFontLoaded, findFont } from "@/lib/fontOptions";

// ---------------------------------------------------------------------------
// ThemeProvider — applies the owner-configured theme to the live site by
// injecting a single <style> element with targeted overrides.
//
// Why this pattern?
//   • The site was built with hardcoded color hex values (e.g. bg-[#C6A15B])
//     which Tailwind compiles to specific CSS rules at build time.
//   • Refactoring every component to CSS variables would touch dozens of
//     files and risk visual regressions.
//   • Injecting a <style> block that overrides ONLY the known token classes
//     is minimal, reversible, and safe — defaults produce a no-op.
// ---------------------------------------------------------------------------

const RADIUS_MAP: Record<ThemeSettings["buttons"]["radius"], string> = {
  full: "9999px",
  lg: "0.75rem",
  md: "0.5rem",
  sm: "0.25rem",
};

const SPACING_MAP: Record<ThemeSettings["ui"]["sectionSpacing"], number> = {
  compact: 0.75,
  normal: 1,
  spacious: 1.25,
};

function generateThemeCSS(theme: ThemeSettings): string {
  const c = theme.colors;
  const spacingMult = SPACING_MAP[theme.ui.sectionSpacing];
  const btnRadius = RADIUS_MAP[theme.buttons.radius];
  const btnScale = theme.buttons.scale;

  // Every hardcoded hex used across the site is remapped here.
  // The Tailwind arbitrary-value class .bg-[#XXXXXX] compiles to a rule
  // .bg-\[\#XXXXXX\], so we escape the same way to override it.
  return `
    :root {
      --theme-accent: ${c.accent};
      --theme-accent-hover: ${c.accentHover};
      --theme-bg: ${c.background};
      --theme-surface: ${c.surface};
      --theme-text: ${c.text};
      --theme-dark-bg: ${c.darkBg};
      --theme-dark-alt: ${c.darkAlt};
      --theme-dark-text: ${c.darkText};
      --theme-btn-radius: ${btnRadius};
      --theme-btn-scale: ${btnScale};
      --font-serif: "${theme.fonts.serif}", "Georgia", serif;
      --font-sans: "${theme.fonts.sans}", ui-sans-serif, system-ui, sans-serif;
    }

    body {
      background-color: var(--theme-bg);
      color: var(--theme-text);
      font-family: var(--font-sans);
      letter-spacing: 0.005em;
    }
    .font-serif {
      font-family: var(--font-serif) !important;
      letter-spacing: -0.01em;
      line-height: 1.15;
    }
    h1, h2, h3, h4, h5, h6 { letter-spacing: -0.01em; }

    /* ---- Accent gold overrides ---- */
    .bg-\\[\\#C6A15B\\] { background-color: var(--theme-accent) !important; }
    .hover\\:bg-\\[\\#B8924B\\]:hover { background-color: var(--theme-accent-hover) !important; }
    .hover\\:bg-\\[\\#D9BA80\\]:hover { background-color: var(--theme-accent-hover) !important; }
    .text-\\[\\#C6A15B\\] { color: var(--theme-accent) !important; }
    .text-\\[\\#D9BA80\\] { color: var(--theme-accent) !important; }
    .border-\\[\\#C6A15B\\] { border-color: var(--theme-accent) !important; }
    .hover\\:border-\\[\\#C6A15B\\]:hover { border-color: var(--theme-accent) !important; }
    .hover\\:text-\\[\\#C6A15B\\]:hover { color: var(--theme-accent) !important; }
    .fill-\\[\\#C6A15B\\] { fill: var(--theme-accent) !important; }
    ::selection { background-color: var(--theme-accent); color: var(--theme-dark-bg); }

    /* ---- Cream background overrides ---- */
    .bg-\\[\\#FAF6EF\\] { background-color: var(--theme-bg) !important; }
    .bg-\\[\\#F3ECDD\\] { background-color: color-mix(in oklab, var(--theme-bg) 85%, var(--theme-accent)) !important; }
    .bg-\\[\\#F4F1EA\\] { background-color: var(--theme-bg) !important; }

    /* ---- Dark surface overrides (CTA, footer, sidebar) ---- */
    .bg-\\[\\#1B1812\\] { background-color: var(--theme-dark-bg) !important; }
    .bg-\\[\\#141210\\] { background-color: var(--theme-dark-alt) !important; }
    .bg-\\[\\#26221C\\] { background-color: var(--theme-dark-bg) !important; }
    .hover\\:bg-\\[\\#3a3327\\]:hover { background-color: color-mix(in oklab, var(--theme-dark-bg) 80%, white) !important; }
    .hover\\:bg-\\[\\#39332A\\]:hover { background-color: color-mix(in oklab, var(--theme-dark-bg) 80%, white) !important; }

    /* ---- Charcoal text overrides ---- */
    .text-\\[\\#26221C\\] { color: var(--theme-text) !important; }
    .hover\\:text-\\[\\#26221C\\]:hover { color: var(--theme-text) !important; }
    .text-\\[\\#221D14\\] { color: var(--theme-dark-bg) !important; }
    .text-\\[\\#F5EFE2\\] { color: var(--theme-dark-text) !important; }
    .text-\\[\\#8A6B32\\] { color: color-mix(in oklab, var(--theme-accent) 70%, black) !important; }

    /* ---- Button styling (radius + scale) ---- */
    /* Applies to Tailwind rounded-full utility on any element that also has
       a pill-style padding — targets the site's primary/secondary/nav CTAs. */
    a.rounded-full, button.rounded-full { border-radius: var(--theme-btn-radius); }
    a.rounded-full[class*="py-4"], a.rounded-full[class*="py-3"],
    button.rounded-full[class*="py-4"], button.rounded-full[class*="py-3"],
    button.rounded-full[class*="py-2.5"] {
      transform: scale(var(--theme-btn-scale));
      transform-origin: left center;
    }

    /* ---- Section spacing multiplier ---- */
    section.py-24 { padding-top: calc(6rem * ${spacingMult}); padding-bottom: calc(6rem * ${spacingMult}); }
    @media (min-width: 1024px) {
      section.lg\\:py-32 { padding-top: calc(8rem * ${spacingMult}); padding-bottom: calc(8rem * ${spacingMult}); }
      section.lg\\:py-28 { padding-top: calc(7rem * ${spacingMult}); padding-bottom: calc(7rem * ${spacingMult}); }
    }

    /* ---- Animation master toggle ---- */
    ${theme.ui.animations ? "" : `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.001ms !important;
      }
    `}
  `;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data } = useCms();
  const theme = data.settings.theme;

  // Load selected fonts from Google Fonts once, on demand
  useEffect(() => {
    const s = findFont(theme.fonts.serif);
    const n = findFont(theme.fonts.sans);
    if (s) ensureFontLoaded(s);
    if (n) ensureFontLoaded(n);
  }, [theme.fonts.serif, theme.fonts.sans]);

  // Inject/refresh the single <style id="site-theme"> element
  useEffect(() => {
    let el = document.getElementById("site-theme") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "site-theme";
      document.head.appendChild(el);
    }
    el.textContent = generateThemeCSS(theme);
  }, [theme]);

  return <>{children}</>;
}
