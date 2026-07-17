import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-xl text-[#26221C] sm:text-2xl lg:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-[13px] text-[#26221C]/55 sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Modern segmented tab bar used across ops pages
export function TabBar<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-6 inline-flex rounded-full border border-[#26221C]/10 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all duration-150 sm:h-9 sm:px-4 sm:text-[13px] ${
            value === t.id
              ? "bg-[#26221C] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              : "text-[#26221C]/55 hover:text-[#26221C]"
          }`}
        >
          <span>{t.label}</span>
          {t.count !== undefined && (
            <span className={`rounded-full px-1.5 text-[10px] font-semibold ${
              value === t.id ? "bg-white/20 text-white" : "bg-[#26221C]/8 text-[#26221C]/60"
            }`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#26221C]/15 bg-white/50 py-16 text-center">
      <p className="font-serif text-lg text-[#26221C]/70">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[#26221C]/45">{description}</p>}
    </div>
  );
}
