import { Plus, Trash2, Star, ImagePlus } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { MediaPickerButton, MediaThumb } from "../shared/MediaPicker";
import type { Testimonial } from "@/types/cms";

export default function TestimonialsManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const items = [...data.testimonials].sort((a, b) => a.order - b.order);

  const setAll = (next: Testimonial[]) => update((d) => ({ ...d, testimonials: next }));

  const patchItem = (id: string, changes: Partial<Testimonial>) =>
    setAll(items.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const addItem = () => {
    setAll([
      ...items,
      {
        id: `test_${Date.now()}`,
        name: "New Guest",
        country: "Country",
        occupation: "Occupation",
        rating: 5,
        quote: "Add a quote here.",
        imageId: "",
        order: items.length,
      },
    ]);
    notify("Testimonial added");
  };

  const deleteItem = (id: string, name: string) => {
    if (window.confirm(`Delete testimonial from "${name}"?`)) {
      setAll(items.filter((i) => i.id !== id));
      notify("Testimonial deleted");
    }
  };

  return (
    <div>
      <PageHeader
        title="Testimonials"
        description="Add, edit, delete and reorder guest testimonials shown on the homepage."
        actions={<Button onClick={addItem}><Plus className="h-4 w-4" /> Add Testimonial</Button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No testimonials yet" description="Add your first guest story." />
      ) : (
        <SortableList
          items={items}
          onChange={(next) => setAll(next.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(t, handle) => (
            <Card className="p-5">
              {/*
                Row layout:
                - mobile: photo + fields stack cleanly
                - desktop: 3-column grid (drag handle · photo · content),
                  so nothing overlaps and the photo has its own space.
              */}
              <div className="flex gap-4">
                <div className="pt-2">{handle}</div>

                {/* Photo column */}
                <div className="flex w-24 shrink-0 flex-col items-center gap-2 sm:w-28">
                  <div className="relative">
                    <MediaThumb mediaId={t.imageId} className="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
                    {!t.imageId && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-[#26221C]/40">
                        <ImagePlus className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <MediaPickerButton
                    compact
                    allowClear
                    value={t.imageId}
                    label={t.imageId ? "Change" : "Upload"}
                    onChange={(id) => { patchItem(t.id, { imageId: id }); notify(id ? "Photo updated" : "Photo removed"); }}
                  />
                </div>

                {/* Content column */}
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Name">
                      <Input value={t.name} onChange={(e) => patchItem(t.id, { name: e.target.value })} onBlur={() => notify("Saved")} />
                    </Field>
                    <Field label="Country">
                      <Input value={t.country} onChange={(e) => patchItem(t.id, { country: e.target.value })} onBlur={() => notify("Saved")} />
                    </Field>
                    <Field label="Occupation">
                      <Input value={t.occupation} onChange={(e) => patchItem(t.id, { occupation: e.target.value })} onBlur={() => notify("Saved")} />
                    </Field>
                  </div>
                  <Field label="Quote">
                    <Textarea rows={2} value={t.quote} onChange={(e) => patchItem(t.id, { quote: e.target.value })} onBlur={() => notify("Saved")} />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26221C]/10 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-[#26221C]/45">Rating</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => patchItem(t.id, { rating: n })}
                            className="p-0.5"
                          >
                            <Star className={`h-4 w-4 ${n <= t.rating ? "fill-[#C6A15B] text-[#C6A15B]" : "text-[#26221C]/20"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem(t.id, t.name)}
                      className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
}
