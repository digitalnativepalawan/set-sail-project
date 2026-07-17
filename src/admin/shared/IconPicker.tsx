import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ICON_OPTIONS, getIcon } from "@/lib/icons";
import { cn } from "@/utils/cn";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
}

/**
 * Visual icon picker: opens a searchable grid popup so admins can browse
 * icons instead of typing/scrolling a raw name dropdown.
 */
export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const CurrentIcon = getIcon(value);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = ICON_OPTIONS.filter((n) => n.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#26221C]/15 bg-white px-3 py-2 text-left text-sm transition hover:border-[#C6A15B]/50"
      >
        <span className="flex items-center gap-2">
          <CurrentIcon className="h-4 w-4 text-[#C6A15B]" />
          <span className="text-[#26221C]">{value}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[#26221C]/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[#26221C]/10 bg-white shadow-lg">
          <div className="border-b border-[#26221C]/10 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#26221C]/30" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons…"
                className="w-full rounded-md bg-[#FAF6EF] py-1.5 pl-8 pr-2 text-xs outline-none placeholder:text-[#26221C]/40"
              />
            </div>
          </div>
          <div className="admin-scroll grid max-h-64 grid-cols-6 gap-1 overflow-y-auto p-2">
            {filtered.map((name) => {
              const I = getIcon(name);
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setQuery(""); }}
                  title={name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md transition",
                    active ? "bg-[#C6A15B] text-[#221D14]" : "text-[#26221C]/60 hover:bg-[#26221C]/5 hover:text-[#C6A15B]"
                  )}
                >
                  <I className="h-4 w-4" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-6 py-6 text-center text-xs text-[#26221C]/40">No icons match "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
