import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

// Compact table/list building blocks used across every operations page.

export function OpsTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#26221C]/8 bg-white shadow-sm">
      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[720px]">{children}</table>
      </div>
    </div>
  );
}

export function OpsTH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("bg-[#FAF6EF] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#26221C]/50", className)}>
      {children}
    </th>
  );
}

export function OpsTD({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("border-t border-[#26221C]/8 px-4 py-3 text-sm text-[#26221C]", className)}>
      {children}
    </td>
  );
}

const STATUS_COLORS: Record<string, string> = {
  // Booking
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  checked_in: "bg-green-100 text-green-700",
  checked_out: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
  // Payment
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-slate-100 text-slate-700",
  // Tour
  completed: "bg-slate-100 text-slate-700",
  // Rental / Bike
  active: "bg-green-100 text-green-700",
  returned: "bg-slate-100 text-slate-700",
  available: "bg-green-100 text-green-700",
  rented: "bg-blue-100 text-blue-700",
  maintenance: "bg-amber-100 text-amber-700",
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  const label = value.replace(/_/g, " ");
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", STATUS_COLORS[value] || "bg-[#26221C]/8 text-[#26221C]/70", className)}>
      {label}
    </span>
  );
}

export function KpiCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "positive" | "warning" }) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "text-[#26221C]";
  return (
    <div className="rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#26221C]/45">{label}</p>
      <p className={cn("mt-2 font-serif text-2xl", toneClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[#26221C]/45">{sub}</p>}
    </div>
  );
}
