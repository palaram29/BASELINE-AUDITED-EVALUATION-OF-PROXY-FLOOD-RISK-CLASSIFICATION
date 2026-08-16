import { useEffect, useState } from "react";
import { getStatistics } from "../services/statisticsService";
import { demoStatistics } from "../utils/demoData";

function useStatistics() {
  const [statistics, setStatistics] = useState(demoStatistics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchStatistics = async () => {
      try {
        const data = await getStatistics();
        if (isMounted) {
          // A genuine response is shown as-is. The demo fallback below is
          // reserved for when the backend is actually unreachable
          // (visibly labeled via `error`), not for any real response.
          setStatistics(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Backend unavailable. Showing demo statistics.");
          setStatistics(demoStatistics);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStatistics();
    // Poll so this page reflects each automatic pipeline run (backend/
    // scheduler.py) without requiring a manual page reload.
    const interval = setInterval(fetchStatistics, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { statistics, loading, error };
}

export default useStatistics;
