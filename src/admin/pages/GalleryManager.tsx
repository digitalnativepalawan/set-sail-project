import { useRef, useState } from "react";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Input } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { MediaPickerButton, MediaThumb } from "../shared/MediaPicker";
import { fileToDataUrl, optimizeImage } from "../shared/fileUtils";
import type { GalleryImage } from "@/types/cms";

export default function GalleryManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const items = [...data.gallery].sort((a, b) => a.order - b.order);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const setAll = (next: GalleryImage[]) => update((d) => ({ ...d, gallery: next }));

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newItems: GalleryImage[] = [];
    for (const file of Array.from(files)) {
      const raw = await fileToDataUrl(file);
      const optimized = await optimizeImage(raw);
      const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      update((d) => ({
        ...d,
        media: [...d.media, { id: mediaId, name: file.name, url: optimized, type: "image", folder: "Gallery", createdAt: new Date().toISOString(), size: file.size, label: file.name }],
      }));
      newItems.push({ id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, mediaId, caption: file.name.replace(/\.[^.]+$/, ""), order: items.length + newItems.length });
    }
    setAll([...items, ...newItems]);
    setUploading(false);
    notify(`${newItems.length} image(s) added to gallery`);
  };

  const addPlaceholder = () => {
    setAll([...items, { id: `gal_${Date.now()}`, mediaId: "", caption: "New Image", order: items.length }]);
  };

  return (
    <div>
      <PageHeader
        title="Gallery Manager"
        description="Upload images from your computer, replace, delete, reorder and caption every photo shown across the site."
        actions={
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
            <Button variant="outline" onClick={addPlaceholder}><Plus className="h-4 w-4" /> Add Slot</Button>
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload Images"}
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No gallery images yet" description="Upload photos to build out your gallery." />
      ) : (
        <SortableList
          items={items}
          onChange={(next) => setAll(next.map((it, idx) => ({ ...it, order: idx })))}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(img, handle) => (
            <Card className="overflow-hidden">
              <div className="relative">
                <MediaThumb mediaId={img.mediaId} className="aspect-[4/3] w-full rounded-none" />
                <div className="absolute left-2 top-2">{handle}</div>
              </div>
              <div className="space-y-2 p-3">
                <Input
                  placeholder="Caption"
                  value={img.caption}
                  onChange={(e) => setAll(items.map((i) => (i.id === img.id ? { ...i, caption: e.target.value } : i)))}
                />
                <div className="flex items-center justify-between">
                  <MediaPickerButton
                    compact
                    allowClear={false}
                    mediaType="both"
                    value={img.mediaId}
                    label="Replace"
                    onChange={(mediaId) => setAll(items.map((i) => (i.id === img.id ? { ...i, mediaId } : i)))}
                  />
                  <button
                    onClick={() => setAll(items.filter((i) => i.id !== img.id))}
                    className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
}
