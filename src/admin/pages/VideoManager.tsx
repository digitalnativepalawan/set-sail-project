import { useRef, useState } from "react";
import { Plus, Trash2, UploadCloud, Film } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { fileToDataUrl } from "../shared/fileUtils";
import { getEmbedUrl, detectVideoType } from "@/lib/videoUtils";
import type { VideoItem } from "@/types/cms";

export default function VideoManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const items = [...data.videos].sort((a, b) => a.order - b.order);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");

  const setAll = (next: VideoItem[]) => update((d) => ({ ...d, videos: next }));

  const addFromUrl = () => {
    if (!pasteUrl.trim()) return;
    const type = detectVideoType(pasteUrl);
    setAll([...items, { id: `vid_${Date.now()}`, title: "Untitled Video", type, url: pasteUrl.trim(), order: items.length }]);
    setPasteUrl("");
    notify("Video added");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      setAll([...items, { id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: file.name, type: "upload", url: dataUrl, order: items.length }]);
    }
    setUploading(false);
    notify("Video uploaded");
  };

  return (
    <div>
      <PageHeader
        title="Video Manager"
        description="Upload video files directly, or paste YouTube/Vimeo links to embed them automatically."
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Paste YouTube or Vimeo URL" hint="e.g. https://www.youtube.com/watch?v=...">
            <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          </Field>
          <Button onClick={addFromUrl}><Plus className="h-4 w-4" /> Add Video</Button>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-[#26221C]/10 pt-4">
          <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload Video File"}
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No videos yet" description="Add a YouTube link, Vimeo link, or upload a video file." />
      ) : (
        <SortableList
          items={items}
          onChange={(next) => setAll(next.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(video, handle) => (
            <Card className="p-4">
              <div className="flex items-start gap-3">
                {handle}
                <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-black/90">
                  {video.type === "upload" ? (
                    <video src={video.url} className="aspect-video w-full object-cover" muted />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center text-white/40">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={video.title}
                    onChange={(e) => setAll(items.map((v) => (v.id === video.id ? { ...v, title: e.target.value } : v)))}
                    placeholder="Video title"
                  />
                  <p className="truncate text-xs text-[#26221C]/45">{video.type.toUpperCase()} · {video.url}</p>
                </div>
                <button onClick={() => setAll(items.filter((v) => v.id !== video.id))} className="text-[#26221C]/30 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          )}
        />
      )}

      {items.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 font-serif text-lg text-[#26221C]">Live Preview</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((v) => (
              <div key={v.id} className="overflow-hidden rounded-xl border border-[#26221C]/10 bg-black">
                {v.type === "upload" ? (
                  <video src={v.url} controls className="aspect-video w-full" />
                ) : (
                  <iframe
                    src={getEmbedUrl(v.type, v.url)}
                    className="aspect-video w-full"
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
