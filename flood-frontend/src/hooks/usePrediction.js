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
          setPrediction(Array.isArray(data) && data.length ? data : demoPredictions);
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

    return () => {
      isMounted = false;
    };
  }, []);

  return { prediction, loading, error };
}

export default usePrediction;
