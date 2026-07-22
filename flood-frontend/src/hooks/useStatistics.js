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
          setStatistics(data || demoStatistics);
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

    return () => {
      isMounted = false;
    };
  }, []);

  return { statistics, loading, error };
}

export default useStatistics;
