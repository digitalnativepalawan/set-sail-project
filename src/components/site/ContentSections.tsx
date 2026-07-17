import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { SectionEyebrow } from "@/components/ui";

export function WorkspaceSection() {
  const { data } = useCms();
  const w = data.workspace;
  return (
    <section id="workspace" className="bg-[#FAF6EF] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <Reveal>
          <ImagePlaceholder mediaId={w.imageId} label="Rooftop Workspace" className="aspect-[4/5] w-full lg:aspect-[3/4]" />
        </Reveal>
        <Reveal delay={0.1}>
          <SectionEyebrow>{w.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{w.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{w.paragraph}</p>
          <div className="mt-10 grid gap-7 sm:grid-cols-1">
            {w.highlights.map((h) => {
              const Icon = getIcon(h.icon);
              return (
                <div key={h.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-serif text-base text-[#26221C]">{h.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{h.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function KitchenSection() {
  const { data } = useCms();
  const k = data.homepage.kitchen;
  return (
    <section id="kitchen" className="bg-white py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <Reveal>
          <SectionEyebrow>{k.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{k.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{k.paragraph}</p>
          <div className="mt-10 space-y-7">
            {k.features.map((f) => {
              const Icon = getIcon(f.icon);
              return (
                <div key={f.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-serif text-base text-[#26221C]">{f.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <ImagePlaceholder mediaId={k.imageId} label="Guest Kitchen" className="aspect-[4/5] w-full lg:aspect-[3/4]" />
        </Reveal>
      </div>
    </section>
  );
}

export function FocusSection() {
  const { data } = useCms();
  const f = data.homepage.focus;
  return (
    <section className="bg-[#F3ECDD] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <Reveal>
          <ImagePlaceholder mediaId={f.imageId} label="Sunset Workspace" className="aspect-[4/5] w-full lg:aspect-[3/4]" />
        </Reveal>
        <Reveal delay={0.1}>
          <SectionEyebrow>{f.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{f.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{f.paragraph}</p>
          <div className="mt-10 grid gap-7 sm:grid-cols-2">
            {f.features.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <div key={item.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-serif text-base text-[#26221C]">{item.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
