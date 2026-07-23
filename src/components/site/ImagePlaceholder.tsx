import { ImageIcon } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { getBackgroundEmbedUrl } from "@/lib/videoUtils";
import { cn } from "@/utils/cn";

interface Props {
  mediaId?: string;
  label?: string;
  className?: string;
  rounded?: string;
}

// Elegant, responsive placeholder used everywhere a real photo (or video)
// will eventually go. If real media has been uploaded through the Media
// Library it renders that instead — so the switch to real photography or
// video is instant with zero code changes anywhere else in the app.
//
// Supports three media states for a given slot:
//   1. Uploaded image            → <img>
//   2. Uploaded video file       → silent, looping, autoplaying <video>
//   3. YouTube / Vimeo link      → background-style iframe embed, scaled to
//                                  fill the container the same way object-cover would
export function ImagePlaceholder({ mediaId, label, className, rounded = "rounded-2xl" }: Props) {
  const { data } = useCms();
  const media = mediaId ? data.media.find((m) => m.id === mediaId) : undefined;
  const resolvedLabel = label || media?.label || "Image";

  // Fallback: treat mediaId as a direct URL when no Media Library entry
  // matches (e.g. legacy defaults or user-pasted paths).
  const directUrl =
    !media && mediaId && (mediaId.startsWith("/") || mediaId.startsWith("http") || mediaId.startsWith("data:"))
      ? mediaId
      : undefined;

  if (media?.url && media.type === "video") {
    if (media.provider === "upload") {
      return (
        <div className={cn("overflow-hidden", rounded, className)}>
          <video
            src={media.url}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            aria-label={resolvedLabel}
          />
        </div>
      );
    }
    // External YouTube/Vimeo — scale the iframe up and crop via overflow
    // hidden so it visually behaves like object-cover for a background video.
    const embedUrl = getBackgroundEmbedUrl(media.provider || "youtube", media.url);
    return (
      <div className={cn("relative overflow-hidden", rounded, className)}>
        <iframe
          src={embedUrl}
          title={resolvedLabel}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
          style={{ border: 0 }}
          allow="autoplay; encrypted-media"
          loading="lazy"
        />
      </div>
    );
  }

  if (media?.url) {
    return (
      <div className={cn("overflow-hidden", rounded, className)}>
        <img src={media.url} alt={resolvedLabel} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (directUrl) {
    return (
      <div className={cn("overflow-hidden", rounded, className)}>
        <img src={directUrl} alt={resolvedLabel} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-[#26221C]/10 bg-[linear-gradient(135deg,#EFE7D6_0%,#E4D9C2_50%,#EFE7D6_100%)]",
        rounded,
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #26221C 0, #26221C 1px, transparent 1px, transparent 14px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 shadow-sm">
          <ImageIcon className="h-5 w-5 text-[#26221C]/40" strokeWidth={1.5} />
        </div>
        <p className="font-serif text-base text-[#26221C]/60">{resolvedLabel}</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#26221C]/35">Image Placeholder</p>
      </div>
    </div>
  );
}
