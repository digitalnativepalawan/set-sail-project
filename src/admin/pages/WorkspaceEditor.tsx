import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { MediaPickerButton } from "../shared/MediaPicker";
import { FeatureListEditor } from "./HomepageEditor";

export default function WorkspaceEditor() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const w = data.workspace;

  return (
    <div>
      <PageHeader title="Workspace" description="Edit the dedicated rooftop workspace section of the site." />

      <Card className="space-y-5 p-6">
        <Field label="Eyebrow">
          <Input value={w.eyebrow} onChange={(e) => update((d) => ({ ...d, workspace: { ...d.workspace, eyebrow: e.target.value } }))} onBlur={() => notify("Workspace updated")} />
        </Field>
        <Field label="Title">
          <Input value={w.title} onChange={(e) => update((d) => ({ ...d, workspace: { ...d.workspace, title: e.target.value } }))} onBlur={() => notify("Workspace updated")} />
        </Field>
        <Field label="Paragraph">
          <Textarea rows={3} value={w.paragraph} onChange={(e) => update((d) => ({ ...d, workspace: { ...d.workspace, paragraph: e.target.value } }))} onBlur={() => notify("Workspace updated")} />
        </Field>
        <Field label="Workspace Media" hint="Image or video — upload from your device or paste a YouTube/Vimeo link.">
          <MediaPickerButton
            mediaType="both"
            value={w.imageId}
            onChange={(id) => { update((d) => ({ ...d, workspace: { ...d.workspace, imageId: id } })); notify(id ? "Media updated" : "Media removed"); }}
          />
        </Field>
      </Card>

      <div className="mt-6">
        <h3 className="mb-3 font-serif text-lg text-[#26221C]">Highlights</h3>
        <FeatureListEditor
          items={w.highlights}
          onChange={(items) => {
            update((d) => ({ ...d, workspace: { ...d.workspace, highlights: items } }));
            notify("Highlights updated");
          }}
        />
      </div>
    </div>
  );
}
