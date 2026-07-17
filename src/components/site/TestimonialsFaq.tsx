import { useState } from "react";
import { Star, ChevronDown } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { Reveal } from "./Reveal";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { cn } from "@/utils/cn";

export function TestimonialsSection() {
  const { data } = useCms();
  const testimonials = [...data.testimonials].sort((a, b) => a.order - b.order);
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-[#F3ECDD] py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">Community</p>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">Stories From the Rooftop</h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl bg-white p-8 shadow-sm shadow-black/[0.03]">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={cn("h-4 w-4", idx < t.rating ? "fill-[#C6A15B] text-[#C6A15B]" : "text-[#26221C]/15")}
                    />
                  ))}
                </div>
                <p className="flex-1 text-[15px] italic leading-relaxed text-[#26221C]/75">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <ImagePlaceholder mediaId={t.imageId} className="h-12 w-12 shrink-0" rounded="rounded-full" />
                  <div>
                    <p className="font-serif text-sm text-[#26221C]">{t.name}</p>
                    <p className="text-xs text-[#26221C]/50">{t.occupation} · {t.country}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const { data } = useCms();
  const faqs = [...data.faqs].sort((a, b) => a.order - b.order);
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  if (faqs.length === 0) return null;

  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-12">
        <Reveal className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">FAQ</p>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">Frequently Asked Questions</h2>
        </Reveal>

        <div className="divide-y divide-[#26221C]/10 border-t border-b border-[#26221C]/10">
          {faqs.map((faq) => {
            const isOpen = open === faq.id;
            return (
              <div key={faq.id}>
                <button
                  onClick={() => setOpen(isOpen ? null : faq.id)}
                  className="group flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[#8A6B32] sm:py-6"
                >
                  <span className="font-serif text-[15px] leading-snug text-[#26221C] transition-colors group-hover:text-[#8A6B32] sm:text-lg">{faq.question}</span>
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/10 text-[#C6A15B] transition-all duration-300 group-hover:bg-[#C6A15B]/20", isOpen && "rotate-180 bg-[#C6A15B]/20")}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </button>
                <div className={cn("grid overflow-hidden transition-all duration-300", isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <p className="max-w-xl text-sm leading-relaxed text-[#26221C]/60">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
