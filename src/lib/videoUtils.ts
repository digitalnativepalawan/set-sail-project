function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function getYoutubeId(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") || "";
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const idx = parts[0] === "embed" || parts[0] === "shorts" ? 1 : -1;
    if (idx > 0) {
      const id = parts[idx] || "";
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }
  }

  return null;
}

export function getVimeoId(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const match = parsed.pathname.match(/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

export function getEmbedUrl(type: "youtube" | "vimeo" | "upload", url: string): string {
  if (type === "youtube") {
    const id = getYoutubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (type === "vimeo") {
    const id = getVimeoId(url);
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }
  return url;
}

export function detectVideoType(url: string): "youtube" | "vimeo" | "upload" {
  if (getYoutubeId(url)) return "youtube";
  if (getVimeoId(url)) return "vimeo";
  return "upload";
}

/** Best-effort static thumbnail for a video — used in admin thumbnails/grids. */
export function getVideoThumbnail(type: "youtube" | "vimeo" | "upload", url: string): string | null {
  if (type === "youtube") {
    const id = getYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }
  return null; // Vimeo/uploaded files don't get a free static thumbnail without extra requests
}

/**
 * Embed URL tuned for silent, looping "background video" use (Hero sections,
 * decorative image-replacement slots) rather than a normal player with
 * controls. Falls back to the standard embed for unknown providers.
 */
export function getBackgroundEmbedUrl(type: "youtube" | "vimeo" | "upload", url: string): string {
  if (type === "youtube") {
    const id = getYoutubeId(url);
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1&playsinline=1&rel=0`;
  }
  if (type === "vimeo") {
    const id = getVimeoId(url);
    if (!id) return url;
    return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1&controls=0`;
  }
  return url;
}
