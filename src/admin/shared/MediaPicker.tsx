import { useRef, useState } from "react";
import { ImageIcon, Search, UploadCloud, X, Video as VideoIcon, Play, Link2, Plus } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Modal, Button, Input } from "@/components/ui";
import { fileToDataUrl, optimizeImage } from "./fileUtils";
import { detectVideoType, getVideoThumbnail } from "@/lib/videoUtils";
import { cn } from "@/utils/cn";
import type { MediaItem } from "@/types/cms";

type MediaKind = "image" | "video" | "both";

// ---------------------------------------------------------------------------
// MediaThumb — renders a thumbnail for either an image or a video media item.
// Videos show a static thumbnail (YouTube) or a muted video frame (uploads),
// always with a small "play" badge so it's obvious it's a video.
// ---------------------------------------------------------------------------
export function MediaThumb({ mediaId, className }: { mediaId?: string; className?: string }) {
  const { data } = useCms();
  const media = data.media.find((m) => m.id === mediaId);

  if (!media?.url) {
    return (
      <div className={cn("flex items-center justify-center overflow-hidden rounded-lg bg-[#EFE7D6]", className)}>
        <ImageIcon className="h-5 w-5 text-[#26221C]/30" />
      </div>
    );
  }

  if (media.type === "video") {
    const thumb = media.provider ? getVideoThumbnail(media.provider, media.url) : null;
    return (
      <div className={cn("relative flex items-center justify-center overflow-hidden rounded-lg bg-[#1B1812]", className)}>
        {thumb ? (
          <img src={thumb} alt={media.label || media.name} className="h-full w-full object-cover opacity-80" />
        ) : media.provider === "upload" ? (
          <video src={media.url} className="h-full w-full object-cover opacity-80" muted />
        ) : (
          <VideoIcon className="h-5 w-5 text-white/40" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
            <Play className="ml-0.5 h-3 w-3 fill-[#26221C] text-[#26221C]" />
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-lg bg-[#EFE7D6]", className)}>
      <img src={media.url} alt={media.label || media.name} className="h-full w-full object-cover" />
    </div>
  );
}

export function MediaPickerButton({
  value,
  onChange,
  label,
  compact = false,
  allowClear = true,
  mediaType = "image",
}: {
  value?: string;
  onChange: (mediaId: string) => void;
  label?: string;
  /** Button-only layout — no inline thumbnail. Useful when the parent already renders a thumb. */
  compact?: boolean;
  /** Show a small × / "Remove" control to unset the media. Defaults to true. */
  allowClear?: boolean;
  /** What kind of media this slot accepts. "both" lets the admin pick an image OR a video. */
  mediaType?: MediaKind;
}) {
  const [open, setOpen] = useState(false);
  const resolvedLabel = label || (mediaType === "video" ? "Choose Video" : mediaType === "both" ? "Choose Media" : "Choose Image");

  const clearButton = allowClear && value && (
    <button
      type="button"
      onClick={() => onChange("")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full p-1 text-[#26221C]/35 transition hover:bg-red-50 hover:text-red-500",
        !compact && "text-xs"
      )}
      title="Remove"
    >
      <X className="h-3.5 w-3.5" />
      {!compact && <span>Remove</span>}
    </button>
  );

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {resolvedLabel}
          </Button>
          {clearButton}
        </div>
        <MediaPickerModal open={open} onClose={() => setOpen(false)} onSelect={(id) => { onChange(id); setOpen(false); }} mediaType={mediaType} />
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MediaThumb mediaId={value} className="h-16 w-16 shrink-0" />
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {resolvedLabel}
      </Button>
      {clearButton}
      <MediaPickerModal open={open} onClose={() => setOpen(false)} onSelect={(id) => { onChange(id); setOpen(false); }} mediaType={mediaType} />
    </div>
  );
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  mediaType = "image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mediaId: string) => void;
  mediaType?: MediaKind;
}) {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"image" | "video">(mediaType === "video" ? "video" : "image");
  const [pasteUrl, setPasteUrl] = useState("");

  const showTabs = mediaType === "both";
  const activeType = mediaType === "both" ? tab : mediaType;

  const filtered = data.media.filter(
    (m) =>
      m.type === activeType &&
      ((m.name || "").toLowerCase().includes(query.toLowerCase()) || (m.label || "").toLowerCase().includes(query.toLowerCase()))
  );

  const addMedia = (entry: MediaItem) => {
    update((draft) => ({ ...draft, media: [...draft.media, entry] }));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let lastUploadedId = "";
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video");
      const raw = await fileToDataUrl(file);
      const finalUrl = isVideo ? raw : await optimizeImage(raw);
      const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      lastUploadedId = id;
      addMedia({
        id,
        name: file.name,
        url: finalUrl,
        type: isVideo ? "video" : "image",
        folder: "Uploads",
        createdAt: new Date().toISOString(),
        size: file.size,
        label: file.name,
        ...(isVideo ? { provider: "upload" as const } : {}),
      });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    notify(activeType === "video" ? "Video uploaded" : "Image uploaded");
    if (lastUploadedId) onSelect(lastUploadedId);
  };

  const addFromUrl = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    const provider = detectVideoType(url);
    if (provider === "upload") {
      notify("Please paste a valid YouTube or Vimeo link", "info");
      return;
    }
    const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    addMedia({
      id,
      name: url,
      url,
      type: "video",
      provider,
      folder: "Videos",
      createdAt: new Date().toISOString(),
      size: 0,
      label: provider === "youtube" ? "YouTube Video" : "Vimeo Video",
    });
    setPasteUrl("");
    notify("Video link added");
    onSelect(id);
  };

  return (
    <Modal open={open} onClose={onClose} title={mediaType === "video" ? "Select or Add Video" : mediaType === "both" ? "Select Image or Video" : "Select or Upload Image"} wide>
      {showTabs && (
        <div className="mb-4 inline-flex rounded-full border border-[#26221C]/10 bg-[#FAF6EF] p-1">
          <button
            onClick={() => setTab("image")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all",
              tab === "image" ? "bg-white text-[#26221C] shadow-sm" : "text-[#26221C]/50 hover:text-[#26221C]"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Images
          </button>
          <button
            onClick={() => setTab("video")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all",
              tab === "video" ? "bg-white text-[#26221C] shadow-sm" : "text-[#26221C]/50 hover:text-[#26221C]"
            )}
          >
            <VideoIcon className="h-3.5 w-3.5" /> Videos
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input placeholder={`Search ${activeType === "video" ? "videos" : "images"}…`} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : `Upload from Device`}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={activeType === "video" ? "video/*" : "image/*"}
          multiple
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {activeType === "video" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
            <Input
              placeholder="Paste a YouTube or Vimeo URL…"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFromUrl()}
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={addFromUrl} disabled={!pasteUrl.trim()}>
            <Plus className="h-4 w-4" /> Add Link
          </Button>
        </div>
      )}

      <div className="grid max-h-[420px] grid-cols-3 gap-3 overflow-y-auto admin-scroll sm:grid-cols-4">
        {filtered.map((m) => {
          const thumb = m.type === "video" && m.provider ? getVideoThumbnail(m.provider, m.url) : null;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-[#26221C]/10 bg-[#EFE7D6] transition hover:ring-2 hover:ring-[#C6A15B]"
            >
              {m.type === "video" ? (
                thumb ? (
                  <img src={thumb} alt={m.label} className="h-full w-full object-cover" />
                ) : m.provider === "upload" && m.url ? (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#1B1812] p-2 text-center">
                    <VideoIcon className="h-5 w-5 text-white/40" />
                    <span className="text-[10px] text-white/50">{m.label}</span>
                  </div>
                )
              ) : m.url ? (
                <img src={m.url} alt={m.label} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <ImageIcon className="h-5 w-5 text-[#26221C]/30" />
                  <span className="text-[10px] text-[#26221C]/40">{m.label}</span>
                </div>
              )}
              {m.type === "video" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-[#26221C] text-[#26221C]" />
                  </span>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                {m.label || m.name}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-[#26221C]/40 sm:col-span-4">
            No {activeType === "video" ? "videos" : "images"} yet — upload one above{activeType === "video" ? " or paste a link" : ""}.
          </p>
        )}
      </div>
    </Modal>
  );
}
