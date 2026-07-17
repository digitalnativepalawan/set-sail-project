import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";

export function FeatureStrip() {
  const { data } = useCms();
  return (
    <section className="border-b border-[#26221C]/8 bg-[#FAF6EF] py-16">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal>
          <p className="mb-10 text-center font-serif text-3xl font-light leading-snug text-[#26221C] sm:text-4xl">
            The Non-Negotiables: Built for Remote Work
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-[#26221C]/10">
          {data.homepage.features.map((f, i) => {
            const Icon = getIcon(f.icon);
            return (
              <Reveal key={f.id} delay={i * 0.08} className="px-2 lg:px-8">
                <div className="flex flex-col items-start gap-3">
                  <Icon className="h-6 w-6 text-[#C6A15B]" strokeWidth={1.5} />
                  <h3 className="font-serif text-lg text-[#26221C]">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-[#26221C]/60">{f.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
