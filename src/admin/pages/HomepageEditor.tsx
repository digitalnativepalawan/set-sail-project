import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch } from "@/components/ui";
import { PageHeader, TabBar } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { MediaPickerButton } from "../shared/MediaPicker";
import { IconPicker } from "../shared/IconPicker";
import { getIcon } from "@/lib/icons";
import type { FeatureItem } from "@/types/cms";

export default function HomepageEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const home = data.homepage;
  const [tab, setTab] = useState<"hero" | "features" | "focus" | "order" | "cta">("hero");

  const save = (msg = "Homepage updated") => notify(msg);

  return (
    <div>
      <PageHeader title="Homepage" description="Edit your hero, feature strip, section order and closing CTA. Changes appear instantly on the live site." />

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "hero", label: "Hero" },
          { id: "features", label: "Features" },
          { id: "focus", label: "Focus" },
          { id: "order", label: "Order" },
          { id: "cta", label: "CTA" },
        ]}
      />

      {tab === "hero" && (
        <Card className="space-y-5 p-6">
          <Field label="Location Eyebrow">
            <Input
              value={home.hero.location}
              onChange={(e) =>
                update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, location: e.target.value } } }))
              }
              onBlur={() => save()}
            />
          </Field>
          <Field label="Headline">
            <Input
              value={home.hero.headline}
              onChange={(e) =>
                update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, headline: e.target.value } } }))
              }
              onBlur={() => save()}
            />
          </Field>
          <Field label="Supporting Text">
            <Textarea
              rows={3}
              value={home.hero.subtext}
              onChange={(e) =>
                update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, subtext: e.target.value } } }))
              }
              onBlur={() => save()}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Primary Button Label">
              <Input
                value={home.hero.primaryButtonLabel}
                onChange={(e) =>
                  update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, primaryButtonLabel: e.target.value } } }))
                }
                onBlur={() => save()}
              />
            </Field>
            <Field label="Primary Button Link" hint="WhatsApp link or #anchor">
              <Input
                value={home.hero.primaryButtonLink}
                onChange={(e) =>
                  update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, primaryButtonLink: e.target.value } } }))
                }
                onBlur={() => save()}
              />
            </Field>
            <Field label="Secondary Button Label">
              <Input
                value={home.hero.secondaryButtonLabel}
                onChange={(e) =>
                  update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, secondaryButtonLabel: e.target.value } } }))
                }
                onBlur={() => save()}
              />
            </Field>
            <Field label="Secondary Button Link">
              <Input
                value={home.hero.secondaryButtonLink}
                onChange={(e) =>
                  update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, secondaryButtonLink: e.target.value } } }))
                }
                onBlur={() => save()}
              />
            </Field>
          </div>
          <Field label="Hero Background" hint="Upload an image or video from your device, or paste a YouTube/Vimeo link for a background video.">
            <MediaPickerButton
              mediaType="both"
              value={home.hero.imageId}
              onChange={(id) => {
                update((d) => ({ ...d, homepage: { ...d.homepage, hero: { ...d.homepage.hero, imageId: id } } }));
                save(id ? "Hero background updated" : "Hero background removed");
              }}
            />
          </Field>
        </Card>
      )}

      {tab === "features" && (
        <FeatureListEditor
          items={home.features}
          onChange={(items) => {
            update((d) => ({ ...d, homepage: { ...d.homepage, features: items } }));
            save("Feature strip updated");
          }}
        />
      )}

      {tab === "focus" && (
        <div>
          <Card className="mb-6 space-y-5 p-6">
            <Field label="Eyebrow">
              <Input
                value={home.focus.eyebrow}
                onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, focus: { ...d.homepage.focus, eyebrow: e.target.value } } }))}
                onBlur={() => save()}
              />
            </Field>
            <Field label="Title">
              <Input
                value={home.focus.title}
                onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, focus: { ...d.homepage.focus, title: e.target.value } } }))}
                onBlur={() => save()}
              />
            </Field>
            <Field label="Paragraph">
              <Textarea
                rows={4}
                value={home.focus.paragraph}
                onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, focus: { ...d.homepage.focus, paragraph: e.target.value } } }))}
                onBlur={() => save()}
              />
            </Field>
            <Field label="Section Media" hint="Image or video — upload from your device or paste a YouTube/Vimeo link.">
              <MediaPickerButton
                mediaType="both"
                value={home.focus.imageId}
                onChange={(id) => {
                  update((d) => ({ ...d, homepage: { ...d.homepage, focus: { ...d.homepage.focus, imageId: id } } }));
                  save(id ? "Media updated" : "Media removed");
                }}
              />
            </Field>
          </Card>
          <FeatureListEditor
            items={home.focus.features}
            onChange={(items) => {
              update((d) => ({ ...d, homepage: { ...d.homepage, focus: { ...d.homepage.focus, features: items } } }));
              save("Focus features updated");
            }}
          />
        </div>
      )}

      {tab === "order" && (
        <Card className="p-6">
          <p className="mb-4 text-sm text-[#26221C]/55">Drag to reorder sections. Toggle visibility to show or hide a section on the homepage.</p>
          <SortableList
            items={home.sectionOrder.map((s) => ({ ...s, id: s.key }))}
            onChange={(items) => {
              const reindexed = items.map(({ id: _id, ...rest }, idx) => ({ ...rest, order: idx }));
              update((d) => ({ ...d, homepage: { ...d.homepage, sectionOrder: reindexed } }));
              save("Section order updated");
            }}
            renderItem={(section, handle) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] px-4 py-3">
                <div className="flex items-center gap-3">
                  {handle}
                  <span className="font-medium text-[#26221C]">{section.label}</span>
                </div>
                <Switch
                  checked={section.visible}
                  onChange={(v) => {
                    const items = home.sectionOrder.map((s) => (s.key === section.key ? { ...s, visible: v } : s));
                    update((d) => ({ ...d, homepage: { ...d.homepage, sectionOrder: items } }));
                    save(v ? `${section.label} shown` : `${section.label} hidden`);
                  }}
                />
              </div>
            )}
          />
        </Card>
      )}

      {tab === "cta" && (
        <Card className="space-y-5 p-6">
          <Field label="CTA Title">
            <Input
              value={home.ctaTitle}
              onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, ctaTitle: e.target.value } }))}
              onBlur={() => save()}
            />
          </Field>
          <Field label="CTA Subtext">
            <Textarea
              rows={2}
              value={home.ctaSubtext}
              onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, ctaSubtext: e.target.value } }))}
              onBlur={() => save()}
            />
          </Field>
          <Field label="Button Label">
            <Input
              value={home.ctaButtonLabel}
              onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, ctaButtonLabel: e.target.value } }))}
              onBlur={() => save()}
            />
          </Field>
        </Card>
      )}
    </div>
  );
}

export function FeatureListEditor({ items, onChange }: { items: FeatureItem[]; onChange: (items: FeatureItem[]) => void }) {
  const addItem = () => {
    onChange([...items, { id: `feat_${Date.now()}`, icon: "Sparkles", title: "New Feature", description: "Describe this feature." }]);
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add Feature</Button>
      </div>
      <SortableList
        items={items}
        onChange={onChange}
        renderItem={(item, handle) => {
          const Icon = getIcon(item.icon);
          return (
            <div className="flex items-start gap-3 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-4">
              {handle}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <Icon className="h-4 w-4 text-[#C6A15B]" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
                  <Input
                    value={item.title}
                    onChange={(e) => onChange(items.map((i) => (i.id === item.id ? { ...i, title: e.target.value } : i)))}
                    placeholder="Title"
                  />
                  <IconPicker
                    value={item.icon}
                    onChange={(icon) => onChange(items.map((i) => (i.id === item.id ? { ...i, icon } : i)))}
                  />
                </div>
                <Textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => onChange(items.map((i) => (i.id === item.id ? { ...i, description: e.target.value } : i)))}
                  placeholder="Description"
                />
              </div>
              <button onClick={() => onChange(items.filter((i) => i.id !== item.id))} className="mt-1 text-[#26221C]/30 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        }}
      />
    </Card>
  );
}
