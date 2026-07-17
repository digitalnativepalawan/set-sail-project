import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { MediaPickerButton, MediaThumb } from "../shared/MediaPicker";
import type { RoomItem } from "@/types/cms";

export default function StayEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const rooms = [...(data.homepage.rooms || [])].sort((a, b) => a.order - b.order);

  const setAllRooms = (next: RoomItem[]) => {
    update((d) => ({
      ...d,
      homepage: {
        ...d.homepage,
        rooms: next.map((r, i) => ({ ...r, order: i })),
      },
    }));
  };

  const addRoom = () => {
    const newRoom: RoomItem = {
      id: `room_${Date.now()}`,
      name: "New Room Type",
      capacity: "2 Adults",
      size: "20sqm",
      view: "Ocean View",
      description: "Describe the new boutique room type here.",
      price: "$30",
      imageKey: "",
      visible: true,
      order: rooms.length,
    };
    setAllRooms([...rooms, newRoom]);
    notify("Room added successfully");
  };

  const deleteRoom = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      setAllRooms(rooms.filter((r) => r.id !== id));
      notify("Room deleted");
    }
  };

  const patchRoom = (id: string, patch: Partial<RoomItem>) => {
    setAllRooms(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div>
      <PageHeader
        title="Stay (Room Settings)"
        description="Add, edit, delete, reorder, and toggle rooms on the website. This directly controls the active room catalog, capacities, sizes, views, prices, and photo slide attachments."
        actions={
          <Button onClick={addRoom}>
            <Plus className="h-4 w-4" /> Add Room Type
          </Button>
        }
      />

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description='Click "Add Room Type" to create your first suite listing.' />
      ) : (
        <SortableList
          items={rooms}
          onChange={setAllRooms}
          renderItem={(room, handle) => (
            <Card className={`p-6 transition-all duration-200 ${!room.visible ? "opacity-60 bg-gray-50/50" : "bg-white"}`}>
              <div className="flex gap-4">
                {/* Drag Handle */}
                <div className="pt-2">{handle}</div>

                {/* Left Thumbnail column */}
                <div className="flex w-24 shrink-0 flex-col items-center gap-2 sm:w-28">
                  <MediaThumb mediaId={room.imageKey} className="aspect-[4/3] w-full rounded-xl" />
                  <MediaPickerButton
                    compact
                    allowClear
                    mediaType="image"
                    value={room.imageKey}
                    label="Choose"
                    onChange={(id) => {
                      patchRoom(room.id, { imageKey: id });
                      notify("Room photo updated");
                    }}
                  />
                </div>

                {/* Right Form Fields */}
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Room Name">
                      <Input
                        value={room.name}
                        onChange={(e) => patchRoom(room.id, { name: e.target.value })}
                        onBlur={() => notify("Saved")}
                      />
                    </Field>
                    <Field label="Sleeps / Capacity" hint="e.g. 2 Adults, 1 Adult">
                      <Input
                        value={room.capacity}
                        onChange={(e) => patchRoom(room.id, { capacity: e.target.value })}
                        onBlur={() => notify("Saved")}
                      />
                    </Field>
                    <Field label="Size (sqm)">
                      <Input
                        value={room.size}
                        onChange={(e) => patchRoom(room.id, { size: e.target.value })}
                        onBlur={() => notify("Saved")}
                      />
                    </Field>
                    <Field label="View" hint="e.g. Ocean View, City View">
                      <Input
                        value={room.view}
                        onChange={(e) => patchRoom(room.id, { view: e.target.value })}
                        onBlur={() => notify("Saved")}
                      />
                    </Field>
                    <Field label="Price" hint="e.g. $42, $32">
                      <Input
                        value={room.price}
                        onChange={(e) => patchRoom(room.id, { price: e.target.value })}
                        onBlur={() => notify("Saved")}
                      />
                    </Field>
                  </div>

                  <Field label="Room Description">
                    <Textarea
                      rows={2}
                      value={room.description}
                      onChange={(e) => patchRoom(room.id, { description: e.target.value })}
                      onBlur={() => notify("Saved")}
                    />
                  </Field>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26221C]/10 pt-3">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#26221C]/50">
                      <Switch
                        checked={room.visible}
                        onChange={(v) => {
                          patchRoom(room.id, { visible: v });
                          notify(v ? `"${room.name}" shown on site` : `"${room.name}" hidden on site`);
                        }}
                      />
                      {room.visible ? (
                        <span className="flex items-center gap-1 text-green-700"><Eye className="h-3.5 w-3.5" /> Visible</span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500"><EyeOff className="h-3.5 w-3.5" /> Hidden</span>
                      )}
                    </label>

                    <button
                      onClick={() => deleteRoom(room.id, room.name)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:underline font-medium uppercase tracking-wide"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete Room Type
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
