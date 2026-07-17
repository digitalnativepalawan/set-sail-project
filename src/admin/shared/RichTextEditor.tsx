import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Heading2, Heading3, Quote as QuoteIcon } from "lucide-react";
import { cn } from "@/utils/cn";

const TOOLS: { icon: typeof Bold; command: string; arg?: string; label: string }[] = [
  { icon: Bold, command: "bold", label: "Bold" },
  { icon: Italic, command: "italic", label: "Italic" },
  { icon: Underline, command: "underline", label: "Underline" },
  { icon: Heading2, command: "formatBlock", arg: "H2", label: "Heading" },
  { icon: Heading3, command: "formatBlock", arg: "H3", label: "Subheading" },
  { icon: QuoteIcon, command: "formatBlock", arg: "BLOCKQUOTE", label: "Quote" },
  { icon: List, command: "insertUnorderedList", label: "Bullet List" },
  { icon: ListOrdered, command: "insertOrderedList", label: "Numbered List" },
];

export function RichTextEditor({ value, onChange, className }: { value: string; onChange: (html: string) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (ref.current && !isFocused.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML || "");
  };

  const handleLink = () => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border border-[#26221C]/15 bg-white", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#26221C]/10 bg-[#FAF6EF] p-2">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.command, t.arg)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#26221C]/60 transition hover:bg-white hover:text-[#26221C]"
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="Insert Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#26221C]/60 transition hover:bg-white hover:text-[#26221C]"
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => (isFocused.current = true)}
        onBlur={() => (isFocused.current = false)}
        onInput={() => onChange(ref.current?.innerHTML || "")}
        className="prose prose-sm min-h-[220px] max-w-none px-4 py-3 text-[#26221C] outline-none prose-headings:font-serif"
      />
    </div>
  );
}
