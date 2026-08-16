import { useEffect, useState } from "react";
import { getPipelineStatus } from "../services/pipelineService";

// Polls the automatic scheduler's real status (backend/scheduler.py via
// GET /system/status) - used to drive both the Pipeline page and the
// Navbar's live-status pill from the same genuine signal, instead of
// each showing its own hardcoded "live"/"ready" claim.
function usePipelineStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const data = await getPipelineStatus();
        if (isMounted) {
          setStatus(data);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Unable to reach the backend to check pipeline status.");
          setStatus(null);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { status, error };
}

export default usePipelineStatus;
