import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CmsData } from "@/types/cms";
import { loadCms, saveCms, resetCms } from "@/lib/storage";

interface CmsContextValue {
  data: CmsData;
  loading: boolean;
  saving: boolean;
  lastSaved: Date | null;
  update: (updater: (draft: CmsData) => CmsData) => void;
  resetAll: () => Promise<void>;
}

const CmsContext = createContext<CmsContextValue | null>(null);

export function CmsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CmsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCms().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const persist = useCallback((next: CmsData) => {
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveCms(next);
      setSaving(false);
      setLastSaved(new Date());
    }, 400);
  }, []);

  const update = useCallback(
    (updater: (draft: CmsData) => CmsData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetAll = useCallback(async () => {
    const fresh = await resetCms();
    setData(fresh);
    setLastSaved(new Date());
  }, []);

  const value = useMemo<CmsContextValue | null>(() => {
    if (!data) return null;
    return { data, loading, saving, lastSaved, update, resetAll };
  }, [data, loading, saving, lastSaved, update, resetAll]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6EF] text-[#3B342B]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C6A15B] border-t-transparent" />
          <p className="font-sans text-sm tracking-wide text-[#3B342B]/60">Loading Marina Terrace…</p>
        </div>
      </div>
    );
  }

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCms() {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms must be used within CmsProvider");
  return ctx;
}
