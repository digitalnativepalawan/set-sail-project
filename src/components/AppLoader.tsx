export function AppLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#FAF6EF] text-[#26221C]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#C6A15B] border-t-transparent" />
        <p className="text-sm text-[#26221C]/55">{label}</p>
      </div>
    </div>
  );
}
