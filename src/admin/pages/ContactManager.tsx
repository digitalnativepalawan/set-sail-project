import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";

export default function ContactManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const c = data.settings.contact;

  const patch = (fn: (draft: typeof c) => typeof c) => {
    update((d) => ({ ...d, settings: { ...d.settings, contact: fn(d.settings.contact) } }));
  };

  return (
    <div>
      <PageHeader title="Contact Manager" description="Manage every contact detail shown across the website, including the footer, WhatsApp buttons and CTAs." />

      <Card className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone Number">
            <Input value={c.phone} onChange={(e) => patch((d) => ({ ...d, phone: e.target.value }))} onBlur={() => notify("Contact info updated")} />
          </Field>
          <Field label="WhatsApp Number (fallback)" hint="Managed primarily in the WhatsApp panel — this is only used as a fallback.">
            <div>
              <Input value={c.whatsapp} onChange={(e) => patch((d) => ({ ...d, whatsapp: e.target.value }))} onBlur={() => notify("Contact info updated")} />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[#8A6B32]">
                <Info className="h-3.5 w-3.5" />
                <Link to="/admin/whatsapp" className="underline underline-offset-2 hover:text-[#26221C]">
                  Manage WhatsApp numbers, message templates &amp; chatbot →
                </Link>
              </p>
            </div>
          </Field>
          <Field label="Email Address">
            <Input value={c.email} onChange={(e) => patch((d) => ({ ...d, email: e.target.value }))} onBlur={() => notify("Contact info updated")} />
          </Field>
          <Field label="Google Maps Link">
            <Input value={c.googleMapsLink} onChange={(e) => patch((d) => ({ ...d, googleMapsLink: e.target.value }))} onBlur={() => notify("Contact info updated")} />
          </Field>
        </div>
        <Field label="Address">
          <Textarea rows={2} value={c.address} onChange={(e) => patch((d) => ({ ...d, address: e.target.value }))} onBlur={() => notify("Contact info updated")} />
        </Field>
        <Field label="Business Hours">
          <Input value={c.businessHours} onChange={(e) => patch((d) => ({ ...d, businessHours: e.target.value }))} onBlur={() => notify("Contact info updated")} />
        </Field>
      </Card>

      <Card className="mt-6 space-y-5 p-6">
        <p className="text-sm font-medium text-[#26221C]">Social Media Links</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram">
            <Input value={c.social.instagram} onChange={(e) => patch((d) => ({ ...d, social: { ...d.social, instagram: e.target.value } }))} onBlur={() => notify("Social links updated")} />
          </Field>
          <Field label="Facebook">
            <Input value={c.social.facebook} onChange={(e) => patch((d) => ({ ...d, social: { ...d.social, facebook: e.target.value } }))} onBlur={() => notify("Social links updated")} />
          </Field>
          <Field label="TikTok">
            <Input value={c.social.tiktok} onChange={(e) => patch((d) => ({ ...d, social: { ...d.social, tiktok: e.target.value } }))} onBlur={() => notify("Social links updated")} />
          </Field>
          <Field label="YouTube">
            <Input value={c.social.youtube} onChange={(e) => patch((d) => ({ ...d, social: { ...d.social, youtube: e.target.value } }))} onBlur={() => notify("Social links updated")} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
