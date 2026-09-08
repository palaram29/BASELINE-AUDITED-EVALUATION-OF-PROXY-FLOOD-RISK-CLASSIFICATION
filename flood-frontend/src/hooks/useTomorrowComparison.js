import { useEffect, useState } from "react";
import { getTomorrowComparison } from "../services/predictionService";

// Same polling/error pattern as usePrediction.js, for the combined
// persistence + ML comparison used on the operator console's Prediction
// page. No demo-data fallback here (unlike usePrediction) - this is a new,
// smaller-audience view and an empty state is clearer than silently
// showing fabricated demo comparison numbers next to real ones elsewhere
// on the same page.
function useTomorrowComparison() {
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchComparison = async () => {
      try {
        const data = await getTomorrowComparison();
        if (isMounted) {
          setComparison(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Backend unavailable - forecast comparison could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchComparison();
    const interval = setInterval(fetchComparison, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { comparison, loading, error };
}

export default useTomorrowComparison;
