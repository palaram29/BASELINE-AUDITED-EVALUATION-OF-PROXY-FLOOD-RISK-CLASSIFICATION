import { useEffect, useState } from "react";
import { getLatestPrediction } from "../services/predictionService";
import { demoPredictions } from "../utils/demoData";

function usePrediction() {
  const [prediction, setPrediction] = useState(demoPredictions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchPrediction = async () => {
      try {
        const data = await getLatestPrediction();
        if (isMounted) {
          // A genuine, successful response is shown as-is - including a
          // genuinely empty array - never silently swapped for demo data.
          // The demo fallback below is reserved for when the backend
          // itself is unreachable (visibly labeled via `error`).
          setPrediction(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Backend unavailable. Showing demo prediction data.");
          setPrediction(demoPredictions);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPrediction();
    // Poll so this page reflects each automatic pipeline run (backend/
    // scheduler.py) without requiring a manual page reload.
    const interval = setInterval(fetchPrediction, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { prediction, loading, error };
}

export default usePrediction;
