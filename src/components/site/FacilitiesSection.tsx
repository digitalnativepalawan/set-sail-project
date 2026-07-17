import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";
import { SectionEyebrow } from "@/components/ui";

export function FacilitiesSection() {
  const { data } = useCms();
  const f = data.homepage.facilities;
  const items = [...f.items]
    .filter((i) => i.visible !== false) // treat missing flag as visible for legacy data
    .sort((a, b) => a.order - b.order);

  if (items.length === 0) return null;

  return (
    <section id="facilities" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto mb-14 max-w-xl text-center">
          <SectionEyebrow>{f.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{f.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-[#26221C]/60">{f.paragraph}</p>
        </Reveal>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-10">
          {items.map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <Reveal key={item.id} delay={i * 0.04}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-[#26221C]">{item.name}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
