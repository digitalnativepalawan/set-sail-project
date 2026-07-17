import { useMemo, useRef, useState } from "react";
import { Search, UploadCloud, Trash2, FolderOpen, Image as ImageIcon, Video as VideoIcon, RefreshCw, Link2, Plus } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Modal, Field } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { fileToDataUrl, optimizeImage } from "../shared/fileUtils";
import { detectVideoType, getVideoThumbnail } from "@/lib/videoUtils";
import type { MediaItem } from "@/types/cms";
import { cn } from "@/utils/cn";

export default function MediaLibrary() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState<MediaItem | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => ["All", ...Array.from(new Set(data.media.map((m) => m.folder)))], [data.media]);

  const items = data.media.filter(
    (m) =>
      (folder === "All" || m.folder === folder) &&
      ((m.label || m.name).toLowerCase().includes(search.toLowerCase()))
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video");
      const raw = await fileToDataUrl(file);
      const finalUrl = isVideo ? raw : await optimizeImage(raw);
      const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      update((d) => ({
        ...d,
        media: [
          ...d.media,
          {
            id, name: file.name, url: finalUrl,
            type: isVideo ? "video" : "image",
            folder: folder === "All" ? "Uploads" : folder,
            createdAt: new Date().toISOString(), size: file.size, label: file.name,
            ...(isVideo ? { provider: "upload" as const } : {}),
          },
        ],
      }));
    }
    setUploading(false);
    notify("Media uploaded");
  };

  const addVideoFromUrl = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    const provider = detectVideoType(url);
    if (provider === "upload") {
      notify("Please paste a valid YouTube or Vimeo link", "info");
      return;
    }
    const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    update((d) => ({
      ...d,
      media: [
        ...d.media,
        {
          id, name: url, url, type: "video", provider,
          folder: folder === "All" ? "Videos" : folder,
          createdAt: new Date().toISOString(), size: 0,
          label: provider === "youtube" ? "YouTube Video" : "Vimeo Video",
        },
      ],
    }));
    setPasteUrl("");
    notify("Video link added");
  };

  const handleReplace = async (file: File | undefined) => {
    if (!file || !replacing) return;
    const isVideo = file.type.startsWith("video");
    const raw = await fileToDataUrl(file);
    const finalUrl = isVideo ? raw : await optimizeImage(raw);
    update((d) => ({
      ...d,
      media: d.media.map((m) =>
        m.id === replacing.id
          ? { ...m, url: finalUrl, type: isVideo ? "video" : "image", size: file.size, ...(isVideo ? { provider: "upload" as const } : { provider: undefined }) }
          : m
      ),
    }));
    notify("File replaced");
    setReplacing(null);
  };

  const deleteItem = (id: string) => {
    if (!window.confirm("Delete this file from the Media Library? Any section using it will show a placeholder instead.")) return;
    update((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
    notify("File deleted");
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Upload, search, replace, delete and organize every image and video used across the website."
        actions={
          <>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload Files"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#26221C]/10 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input
            placeholder="Paste a YouTube or Vimeo URL to add it to the library…"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addVideoFromUrl()}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={addVideoFromUrl} disabled={!pasteUrl.trim()}>
          <Plus className="h-4 w-4" /> Add Video Link
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input placeholder="Search media…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setFolder(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                folder === f ? "bg-[#26221C] text-white" : "bg-white text-[#26221C]/60 hover:bg-[#26221C]/5"
              )}
            >
              <FolderOpen className="h-3 w-3" /> {f}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No media found" description="Upload files or adjust your search/folder filter." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl border border-[#26221C]/10 bg-white">
              <div className="relative flex aspect-square items-center justify-center bg-[#EFE7D6]">
                {m.type === "video" ? (
                  (() => {
                    const thumb = m.provider ? getVideoThumbnail(m.provider, m.url) : null;
                    if (thumb) return <img src={thumb} alt={m.label || m.name} className="h-full w-full object-cover" />;
                    if (m.provider === "upload" && m.url) return <video src={m.url} className="h-full w-full object-cover" muted />;
                    return (
                      <div className="flex flex-col items-center gap-1.5 bg-[#1B1812] p-3 text-center">
                        <VideoIcon className="h-5 w-5 text-white/40" />
                        <span className="text-[10px] text-white/50">{m.label}</span>
                      </div>
                    );
                  })()
                ) : m.url ? (
                  <img src={m.url} alt={m.label || m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                    <ImageIcon className="h-5 w-5 text-[#26221C]/30" />
                    <span className="text-[10px] text-[#26221C]/40">{m.label}</span>
                  </div>
                )}
                {m.type === "video" && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                      <VideoIcon className="h-3.5 w-3.5 text-[#26221C]" />
                    </span>
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-[#26221C]">{m.label || m.name}</p>
                <p className="text-[10px] text-[#26221C]/40">{m.folder}</p>
              </div>
              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/40 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => setReplacing(m)} className="rounded-md bg-white/90 p-1.5 text-[#26221C] hover:bg-white">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => deleteItem(m.id)} className="rounded-md bg-white/90 p-1.5 text-red-500 hover:bg-white">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!replacing} onClose={() => setReplacing(null)} title={`Replace: ${replacing?.label || replacing?.name || ""}`}>
        <Field label="Choose a new file">
          <input ref={replaceRef} type="file" accept="image/*,video/*" onChange={(e) => handleReplace(e.target.files?.[0])} />
        </Field>
      </Modal>
    </div>
  );
}
