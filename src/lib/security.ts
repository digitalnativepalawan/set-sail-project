import DOMPurify from "dompurify";

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------
// 1. sanitizeHtml() removes XSS payloads from rich text before rendering.
// 2. safeHref() only allows explicitly approved URL schemes / relative links.
// ---------------------------------------------------------------------------

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "target",
      "rel",
      "title",
    ],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

export function safeHref(input: string, fallback = "#"): string {
  const value = (input || "").trim();
  if (!value) return fallback;

  // Internal anchors and relative paths are allowed.
  if (value.startsWith("#") || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
    return value;
  }

  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (["http:", "https:", "mailto:", "tel:"].includes(protocol)) return value;
    return fallback;
  } catch {
    return fallback;
  }
}

export function safeTel(input: string): string {
  return safeHref(`tel:${input.replace(/\s+/g, "")}`, "#");
}

export function safeMailto(input: string): string {
  return safeHref(`mailto:${input}`, "#");
}
