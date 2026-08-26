import { useCallback, useEffect, useState } from "react";

/**
 * Fetches `fetcher()` once on mount and then every `intervalMs`, so a
 * page reflects each automatic backend pipeline run without a reload.
 * `fetcher` must be a stable reference (a module-level service function
 * or a useCallback). Returns { data, loading, error, refresh, lastUpdated }.
 */
export default function useLiveData(fetcher, { intervalMs = 60000, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const result = await fetcher();
        if (!isMounted) return;
        setData(result);
        setError("");
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("We couldn't reach the flood service. Showing the last available data.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const id = intervalMs ? setInterval(load, intervalMs) : null;

    return () => {
      isMounted = false;
      if (id) clearInterval(id);
    };
  }, [fetcher, intervalMs, reloadToken]);

  return { data, loading, error, refresh, lastUpdated };
}
