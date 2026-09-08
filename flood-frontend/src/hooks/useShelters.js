import { useEffect, useRef, useState } from "react";
import { getShelters } from "../services/shelterService";

// Data-fetching hook for the Shelters page. Polls every 30s, same cadence
// as useUsers, so an edit made from another tab/session shows up without
// a manual reload. Exposes `refresh` (awaitable) for an immediate refetch
// right after a create/update/delete so the table doesn't wait for the
// next tick - it calls the same fetch function the effect uses, via a ref,
// since a plain function called from an effect (not defined inside one)
// trips react-hooks' set-state-in-effect check.
function useShelters() {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchRef = useRef(() => Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    const fetchShelters = async () => {
      try {
        const data = await getShelters();
        if (isMounted) {
          setShelters(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Unable to load shelters. Is the backend running?");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRef.current = fetchShelters;
    fetchShelters();
    const interval = setInterval(fetchShelters, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const refresh = () => fetchRef.current();

  return { shelters, loading, error, refresh };
}

export default useShelters;
