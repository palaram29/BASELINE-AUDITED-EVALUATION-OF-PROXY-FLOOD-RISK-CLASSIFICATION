import { useEffect, useState } from "react";
import { getLatestRiver } from "../services/riverService";
import { demoRiver } from "../utils/demoData";

function useRiver() {
  const [river, setRiver] = useState(demoRiver);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchRiver = async () => {
      try {
        const data = await getLatestRiver();
        if (isMounted) {
          // Genuine responses (including a genuinely empty array) are
          // shown as-is - never silently swapped for demo data. The demo
          // fallback below is reserved for when the backend is actually
          // unreachable (visibly labeled via `error`).
          setRiver(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Backend unavailable. Showing demo river data.");
          setRiver(demoRiver);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRiver();
    // Poll so this page reflects each automatic pipeline run (backend/
    // scheduler.py) without requiring a manual page reload.
    const interval = setInterval(fetchRiver, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { river, loading, error };
}

export default useRiver;
