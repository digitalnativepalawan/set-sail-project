import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

// A small set of shadcn/ui-style primitives, hand-rolled to keep the
// dependency footprint light while matching the same API shape.

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
    size?: "sm" | "md" | "lg";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  // Modern, refined button system:
  // - Subtle shadows & inner-highlight rings instead of heavy borders
  // - Micro-interaction on active (scale-[0.98]) for tactile feedback
  // - Responsive sizing: tighter on mobile, comfortable on desktop
  const variants: Record<string, string> = {
    primary:
      "bg-[#C6A15B] text-[#221D14] hover:bg-[#B8924B] active:bg-[#A88342] shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_2px_8px_rgba(198,161,91,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]",
    secondary:
      "bg-[#26221C] text-[#F5EFE2] hover:bg-[#3a3327] active:bg-[#1F1B15] shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]",
    outline:
      "border border-[#26221C]/15 bg-white text-[#26221C] hover:border-[#26221C]/30 hover:bg-[#FAF6EF] active:bg-[#F3ECDD]",
    ghost:
      "text-[#26221C]/70 hover:bg-[#26221C]/5 hover:text-[#26221C] active:bg-[#26221C]/8",
    danger:
      "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]",
  };
  // Responsive sizing — each size steps up ~10% on sm breakpoint (≥640px)
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-[12px] sm:h-9 sm:px-3.5",
    md: "h-9 px-4 text-[13px] sm:h-10 sm:px-5 sm:text-sm",
    lg: "h-11 px-5 text-sm sm:h-12 sm:px-7 sm:text-[15px]",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium leading-none",
        "transition-[background-color,box-shadow,transform,border-color] duration-150 ease-out",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-[#26221C]/8 bg-white shadow-sm shadow-black/[0.03]", className)}>
      {children}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-[#26221C]/15 bg-white px-3.5 py-2.5 text-sm text-[#26221C] outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-[#26221C]/15 bg-white px-3.5 py-2.5 text-sm text-[#26221C] outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-[#26221C]/15 bg-white px-3.5 py-2.5 text-sm text-[#26221C] outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#26221C]/50", className)}>{children}</label>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#26221C]/40">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-[#C6A15B]" : "bg-[#26221C]/15"
      )}
      aria-pressed={checked}
      aria-label={label}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-1"
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-[#C6A15B]/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#8A6B32]", className)}>
      {children}
    </span>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">
      {children}
    </p>
  );
}

export function IconButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#26221C]/10 text-[#26221C]/60 transition-all duration-150 hover:border-[#C6A15B]/40 hover:bg-[#FAF6EF] hover:text-[#C6A15B] active:scale-95 sm:h-9 sm:w-9",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm">
      <div className={cn("w-full rounded-2xl bg-white p-6 shadow-2xl", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-xl text-[#26221C]">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#26221C]/40 hover:bg-[#26221C]/5 hover:text-[#26221C]">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
