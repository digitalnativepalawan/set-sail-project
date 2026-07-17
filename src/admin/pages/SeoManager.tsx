import { Download } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { MediaPickerButton } from "../shared/MediaPicker";

function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SeoManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const seo = data.settings.seo;

  const patch = (fn: (d: typeof seo) => typeof seo) => update((d) => ({ ...d, settings: { ...d.settings, seo: fn(d.settings.seo) } }));

  const origin = typeof window !== "undefined" ? window.location.origin : "https://marinaterrace.com";

  const generateSitemap = () => {
    const staticUrls = ["/", "/blog"];
    const postUrls = data.blogPosts.filter((p) => p.status === "published").map((p) => `/blog/${p.slug}`);
    const urls = [...staticUrls, ...postUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url>\n    <loc>${origin}${u}</loc>\n  </url>`)
      .join("\n")}\n</urlset>`;
    download("sitemap.xml", xml, "application/xml");
    notify("sitemap.xml generated and downloaded");
  };

  const generateRobots = () => {
    const txt = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${origin}/sitemap.xml\n`;
    download("robots.txt", txt);
    notify("robots.txt generated and downloaded");
  };

  return (
    <div>
      <PageHeader title="SEO Manager" description="Control page titles, meta descriptions, keywords and the Open Graph image. Generate sitemap.xml and robots.txt any time." />

      <Card className="space-y-5 p-6">
        <Field label="Site Title (browser tab)">
          <Input value={seo.siteTitle} onChange={(e) => patch((d) => ({ ...d, siteTitle: e.target.value }))} onBlur={() => notify("SEO updated")} />
        </Field>
        <Field label="Homepage Title">
          <Input value={seo.homeTitle} onChange={(e) => patch((d) => ({ ...d, homeTitle: e.target.value }))} onBlur={() => notify("SEO updated")} />
        </Field>
        <Field label="Homepage Meta Description">
          <Textarea rows={3} value={seo.homeDescription} onChange={(e) => patch((d) => ({ ...d, homeDescription: e.target.value }))} onBlur={() => notify("SEO updated")} />
        </Field>
        <Field label="Keywords" hint="Comma-separated">
          <Input value={seo.keywords} onChange={(e) => patch((d) => ({ ...d, keywords: e.target.value }))} onBlur={() => notify("SEO updated")} />
        </Field>
        <Field label="Open Graph Image">
          <MediaPickerButton value={seo.ogImageId} onChange={(id) => { patch((d) => ({ ...d, ogImageId: id })); notify(id ? "OG image updated" : "OG image removed"); }} />
        </Field>
      </Card>

      <Card className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-serif text-lg text-[#26221C]">Sitemap &amp; Robots</p>
          <p className="text-sm text-[#26221C]/55">Automatically generate these files from your current content, then upload them to your server root.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={generateRobots}><Download className="h-4 w-4" /> robots.txt</Button>
          <Button onClick={generateSitemap}><Download className="h-4 w-4" /> sitemap.xml</Button>
        </div>
      </Card>
    </div>
  );
}
