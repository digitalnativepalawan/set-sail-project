import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch, Badge } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { IconPicker } from "../shared/IconPicker";
import { getIcon } from "@/lib/icons";
import { cn } from "@/utils/cn";
import type { FacilityItem } from "@/types/cms";

export default function FacilitiesEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const f = data.homepage.facilities;
  const items = [...f.items].sort((a, b) => a.order - b.order);
  const visibleCount = items.filter((i) => i.visible).length;

  const patch = (fn: (d: typeof f) => typeof f) =>
    update((d) => ({ ...d, homepage: { ...d.homepage, facilities: fn(d.homepage.facilities) } }));

  const setItems = (next: FacilityItem[]) =>
    patch((d) => ({ ...d, items: next.map((it, i) => ({ ...it, order: i })) }));

  const patchItem = (id: string, changes: Partial<FacilityItem>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const addItem = () => {
    setItems([
      ...items,
      { id: `fac_${Date.now()}`, icon: "Sparkles", name: "New facility", order: items.length, visible: true },
    ]);
    notify("Facility added — showing on the site");
  };

  const deleteItem = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}" from the Facilities section?`)) {
      setItems(items.filter((i) => i.id !== id));
      notify("Facility deleted");
    }
  };

  const toggleAll = (show: boolean) => {
    setItems(items.map((i) => ({ ...i, visible: show })));
    notify(show ? "All facilities are showing" : "All facilities hidden");
  };

  return (
    <div>
      <PageHeader
        title="Facilities"
        description="Room amenities shown on the homepage. Add, delete, drag to reorder, and toggle each item on/off — changes appear on the live site instantly."
        actions={<Button onClick={addItem}><Plus className="h-4 w-4" /> Add Facility</Button>}
      />

      {/* Section text */}
      <Card className="mb-6 space-y-5 p-6">
        <Field label="Eyebrow">
          <Input value={f.eyebrow} onChange={(e) => patch((d) => ({ ...d, eyebrow: e.target.value }))} onBlur={() => notify("Saved")} />
        </Field>
        <Field label="Section Title">
          <Input value={f.title} onChange={(e) => patch((d) => ({ ...d, title: e.target.value }))} onBlur={() => notify("Saved")} />
        </Field>
        <Field label="Intro Paragraph">
          <Textarea rows={2} value={f.paragraph} onChange={(e) => patch((d) => ({ ...d, paragraph: e.target.value }))} onBlur={() => notify("Saved")} />
        </Field>
      </Card>

      {/* Bulk actions bar */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#26221C]/10 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge>{visibleCount} of {items.length} showing</Badge>
            <span className="text-xs text-[#26221C]/45">on the live site</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#26221C]/60 hover:bg-[#26221C]/5 hover:text-[#26221C]"
            >
              <Eye className="h-3.5 w-3.5" /> Show all
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#26221C]/60 hover:bg-[#26221C]/5 hover:text-[#26221C]"
            >
              <EyeOff className="h-3.5 w-3.5" /> Hide all
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No facilities yet" description='Click "Add Facility" to add your first amenity.' />
      ) : (
        <SortableList
          items={items}
          onChange={setItems}
          renderItem={(item, handle) => {
            const Icon = getIcon(item.icon);
            return (
              <Card
                className={cn(
                  "p-4 transition",
                  !item.visible && "opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  {handle}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" />
                  </div>
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_200px]">
                    <Input
                      value={item.name}
                      onChange={(e) => patchItem(item.id, { name: e.target.value })}
                      onBlur={() => notify("Saved")}
                      placeholder="Facility name"
                    />
                    <IconPicker
                      value={item.icon}
                      onChange={(icon) => { patchItem(item.id, { icon }); notify("Icon updated"); }}
                    />
                  </div>
                  <label
                    className="flex items-center gap-2 border-l border-[#26221C]/10 pl-3"
                    title={item.visible ? "Visible on site — click to hide" : "Hidden — click to show"}
                  >
                    <Switch
                      checked={item.visible}
                      onChange={(v) => {
                        patchItem(item.id, { visible: v });
                        notify(v ? `"${item.name}" is showing` : `"${item.name}" is hidden`);
                      }}
                    />
                  </label>
                  <button
                    onClick={() => deleteItem(item.id, item.name)}
                    className="rounded-md p-1.5 text-[#26221C]/30 transition hover:bg-red-50 hover:text-red-500"
                    title="Delete facility"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          }}
        />
      )}
    </div>
  );
}
