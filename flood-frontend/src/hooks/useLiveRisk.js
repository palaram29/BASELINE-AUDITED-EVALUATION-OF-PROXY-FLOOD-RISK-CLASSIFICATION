import { useEffect, useState } from "react";
import { getLiveRisk } from "../services/predictionService";
import { demoLiveRisk } from "../utils/demoData";

// The same-day ("Today") rule-based flood-risk index. Mirrors
// usePrediction.js (the t+1 "Tomorrow" ML forecast): fetch on mount, poll
// every 30s to reflect each automatic pipeline run, and fall back to demo
// data only when the backend itself is unreachable (labeled via `error`).
function useLiveRisk() {
  const [liveRisk, setLiveRisk] = useState(demoLiveRisk);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchLiveRisk = async () => {
      try {
        const data = await getLiveRisk();
        if (isMounted) {
          setLiveRisk(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Backend unavailable. Showing demo current-risk data.");
          setLiveRisk(demoLiveRisk);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLiveRisk();
    const interval = setInterval(fetchLiveRisk, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { liveRisk, loading, error };
}

export default useLiveRisk;
