import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { MediaPickerButton } from "../shared/MediaPicker";
import { FeatureListEditor } from "./HomepageEditor";

export default function KitchenEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const k = data.homepage.kitchen;

  return (
    <div>
      <PageHeader title="Kitchen" description="Edit the Premium Community Kitchen section." />

      <Card className="space-y-5 p-6">
        <Field label="Eyebrow">
          <Input value={k.eyebrow} onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, kitchen: { ...d.homepage.kitchen, eyebrow: e.target.value } } }))} onBlur={() => notify("Kitchen updated")} />
        </Field>
        <Field label="Title">
          <Input value={k.title} onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, kitchen: { ...d.homepage.kitchen, title: e.target.value } } }))} onBlur={() => notify("Kitchen updated")} />
        </Field>
        <Field label="Paragraph">
          <Textarea rows={4} value={k.paragraph} onChange={(e) => update((d) => ({ ...d, homepage: { ...d.homepage, kitchen: { ...d.homepage.kitchen, paragraph: e.target.value } } }))} onBlur={() => notify("Kitchen updated")} />
        </Field>
        <Field label="Kitchen Media" hint="Image or video — upload from your device or paste a YouTube/Vimeo link.">
          <MediaPickerButton
            mediaType="both"
            value={k.imageId}
            onChange={(id) => { update((d) => ({ ...d, homepage: { ...d.homepage, kitchen: { ...d.homepage.kitchen, imageId: id } } })); notify(id ? "Media updated" : "Media removed"); }}
          />
        </Field>
      </Card>

      <div className="mt-6">
        <h3 className="mb-3 font-serif text-lg text-[#26221C]">Kitchen Features</h3>
        <FeatureListEditor
          items={k.features}
          onChange={(items) => {
            update((d) => ({ ...d, homepage: { ...d.homepage, kitchen: { ...d.homepage.kitchen, features: items } } }));
            notify("Kitchen features updated");
          }}
        />
      </div>
    </div>
  );
}
