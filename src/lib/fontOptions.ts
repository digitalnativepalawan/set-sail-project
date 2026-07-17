// Curated Google Fonts — sorted so the best pairing for Marina Terrace is
// first. Every entry loads dynamically when selected in the Appearance
// manager so we don't preload fonts the owner may never use.

export interface FontOption {
  name: string;         // family name used in CSS
  category: "serif" | "sans" | "display";
  googleParams: string; // ?family=… value for fonts.googleapis.com/css2
}

export const SERIF_FONTS: FontOption[] = [
  // ★ Default — used by luxury resorts, Aman, high-end editorial
  { name: "Cormorant Garamond", category: "serif", googleParams: "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600" },
  // Strong alternatives
  { name: "Playfair Display",   category: "serif", googleParams: "Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500" },
  { name: "DM Serif Display",   category: "display", googleParams: "DM+Serif+Display:ital,wght@0,400;1,400" },
  { name: "Fraunces",           category: "serif", googleParams: "Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600" },
  { name: "Lora",               category: "serif", googleParams: "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500" },
  { name: "EB Garamond",        category: "serif", googleParams: "EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500" },
  { name: "Crimson Pro",        category: "serif", googleParams: "Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400" },
  { name: "Libre Baskerville",  category: "serif", googleParams: "Libre+Baskerville:ital,wght@0,400;0,700;1,400" },
];

export const SANS_FONTS: FontOption[] = [
  // ★ Default — warm geometric, used by modern SaaS & hospitality brands
  { name: "Plus Jakarta Sans", category: "sans", googleParams: "Plus+Jakarta+Sans:wght@300;400;500;600;700" },
  // Strong alternatives
  { name: "DM Sans",           category: "sans", googleParams: "DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700" },
  { name: "Manrope",           category: "sans", googleParams: "Manrope:wght@300;400;500;600;700" },
  { name: "Inter",             category: "sans", googleParams: "Inter:wght@300;400;500;600;700" },
  { name: "Outfit",            category: "sans", googleParams: "Outfit:wght@300;400;500;600;700" },
  { name: "Figtree",           category: "sans", googleParams: "Figtree:wght@300;400;500;600;700" },
  { name: "Work Sans",         category: "sans", googleParams: "Work+Sans:wght@300;400;500;600;700" },
  { name: "Space Grotesk",     category: "sans", googleParams: "Space+Grotesk:wght@300;400;500;600;700" },
];

/** Dynamically inject a Google Font stylesheet the first time it's requested. */
export function ensureFontLoaded(option: FontOption) {
  const id = `gfont-${option.name.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${option.googleParams}&display=swap`;
  document.head.appendChild(link);
}

export function findFont(name: string): FontOption | undefined {
  return [...SERIF_FONTS, ...SANS_FONTS].find((f) => f.name === name);
}
