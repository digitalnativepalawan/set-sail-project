import { useCallback, useEffect, useState } from "react";
import { fetchKnowledge, type TalaKnowledgeEntry } from "./talaKnowledge";

/** Live knowledge-base entries, fetched once per mount and refreshable. */
export function useTalaKnowledge() {
  const [entries, setEntries] = useState<TalaKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await fetchKnowledge());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}
