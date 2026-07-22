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
          setRiver(Array.isArray(data) && data.length ? data : demoRiver);
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

    return () => {
      isMounted = false;
    };
  }, []);

  return { river, loading, error };
}

export default useRiver;
