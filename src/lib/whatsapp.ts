import type { WhatsAppSettings, ContactInfo } from "@/types/cms";

// ---------------------------------------------------------------------------
// WhatsApp helpers — single source of truth for building WhatsApp links.
// Every "Message on WhatsApp" button on the site funnels through here so the
// admin can change the number (or message template) in one place and have it
// reflected everywhere instantly.
// ---------------------------------------------------------------------------

export function getPrimaryNumber(wa: WhatsAppSettings, contact?: ContactInfo): string {
  const primary = wa.numbers.find((n) => n.isPrimary) || wa.numbers[0];
  return primary?.number || contact?.whatsapp || "";
}

/** Strip everything except digits so `wa.me/…` accepts it. */
export function normalizeNumber(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

/** Build a wa.me link with an optional pre-filled message. */
export function buildWhatsAppLink(
  wa: WhatsAppSettings,
  contact?: ContactInfo,
  opts?: { message?: string; numberId?: string; tokens?: Record<string, string> }
): string {
  let number = "";
  if (opts?.numberId) {
    number = wa.numbers.find((n) => n.id === opts.numberId)?.number || "";
  }
  if (!number) number = getPrimaryNumber(wa, contact);
  const digits = normalizeNumber(number);

  let message = opts?.message ?? wa.defaultMessage ?? "";
  if (opts?.tokens) {
    for (const [k, v] of Object.entries(opts.tokens)) {
      message = message.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }

  const base = `https://wa.me/${digits}`;
  return message.trim() ? `${base}?text=${encodeURIComponent(message)}` : base;
}
