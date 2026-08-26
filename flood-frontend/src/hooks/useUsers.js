import { useEffect, useState } from "react";
import { getUsers } from "../services/adminService";

// Data-fetching hook for the Users page. Polls every 30s so a fresh
// citizen-frontend registration (or a risk-tier change on someone's
// area) shows up without a manual reload - same cadence as
// useStatistics/useWeather/etc.
function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Unable to load registered users. Is the backend running?");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { users, loading, error };
}

export default useUsers;
