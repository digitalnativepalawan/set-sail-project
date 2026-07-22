import { supabase, isSupabaseConnected } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// TALA's knowledge base — free-form facts an admin maintains directly
// (hours, policies, local info), separate from the structured CMS data
// (rooms/pricing) that already feeds her prompt. Lives in its own table so
// bulk CSV import/export doesn't touch the monolithic cms_data blob.
//
// Prices are stripped before any entry reaches the model: pricing has one
// source of truth (the CMS Rooms/Pricing pages), and a knowledge entry
// written months ago shouldn't be able to contradict it.
// ---------------------------------------------------------------------------

export interface TalaKnowledgeEntry {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string;
  enabled: boolean;
  sort_order: number;
}

const CSV_COLUMNS = ["topic", "label", "body", "tags", "enabled", "sort_order"] as const;

/** Strip anything that looks like a price so stale numbers can't reach TALA. */
export function stripPrices(text: string): string {
  return text
    .replace(/[₱$€£]\s?[\d,]+(?:\.\d+)?(?:\s?\/\s?\w+)?/g, "[price removed — see current pricing]")
    .replace(/\bPHP\s?[\d,]+(?:\.\d+)?/gi, "[price removed — see current pricing]")
    .replace(/\b[\d,]+(?:\.\d+)?\s?(?:pesos|php)\b/gi, "[price removed — see current pricing]");
}

export async function fetchKnowledge(): Promise<TalaKnowledgeEntry[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_knowledge")
    .select("id, topic, label, body, tags, enabled, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as TalaKnowledgeEntry[];
}

/** What TALA actually sees: enabled entries only, sorted, prices stripped. */
export function knowledgeForPrompt(entries: TalaKnowledgeEntry[]): string {
  return entries
    .filter((e) => e.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => `${e.label}: ${stripPrices(e.body)}`)
    .join("\n");
}

// ---- CSV import/export -----------------------------------------------------
// Minimal RFC4180-ish parser/serializer: handles quoted fields, embedded
// commas, and doubled-quote escaping — no dependency needed for six columns.

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Splits CSV text into rows, respecting quoted newlines inside fields. */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.trim().length) rows.push(cur);
      cur = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length) rows.push(cur);
  return rows;
}

export interface ParsedKnowledgeRow {
  topic: string;
  label: string;
  body: string;
  tags: string;
  enabled: boolean;
  sort_order: number;
}

const BOM = String.fromCharCode(0xfeff);

export function parseKnowledgeCsv(text: string): { rows: ParsedKnowledgeRow[]; errors: string[] } {
  const withoutBom = text.startsWith(BOM) ? text.slice(1) : text;
  const lines = splitCsvRows(withoutBom); // strip BOM if present
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["Empty file."] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [`Missing column(s): ${missing.join(", ")}`] };
  }

  const rows: ParsedKnowledgeRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.every((f) => !f.trim())) continue;
    const get = (col: (typeof CSV_COLUMNS)[number]) => fields[header.indexOf(col)] ?? "";
    const topic = get("topic").trim();
    const label = get("label").trim();
    if (!topic || !label) {
      errors.push(`Row ${i + 1}: topic and label are required — skipped.`);
      continue;
    }
    const sortRaw = get("sort_order").trim();
    rows.push({
      topic,
      label,
      body: get("body").trim(),
      tags: get("tags").trim(),
      enabled: /^(true|1|yes)$/i.test(get("enabled").trim() || "true"),
      sort_order: sortRaw ? Number(sortRaw) || 0 : 0,
    });
  }
  return { rows, errors };
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toKnowledgeCsv(entries: TalaKnowledgeEntry[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = entries.map((e) =>
    CSV_COLUMNS.map((col) =>
      csvEscape(col === "enabled" ? (e.enabled ? "true" : "false") : e[col]),
    ).join(","),
  );
  return [header, ...lines].join("\n");
}

export function knowledgeCsvTemplate(): string {
  return [
    CSV_COLUMNS.join(","),
    'breakfast,"Breakfast hours","Breakfast is served 08:30-10:30 daily.","breakfast;dining;hours",true,10',
  ].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
