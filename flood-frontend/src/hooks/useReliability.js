import { useCallback, useEffect, useState } from "react";
import {
  getReliabilitySummary,
  getReliabilitySources,
  getValidationFlags,
} from "../services/reliabilityService";

// Data-fetching hook for the Data Reliability page/widgets. Polls every
// 30s (matches useMLOpsMonitoring.js's cadence - this is monitoring/status
// data, not results data). Promise.allSettled so a fresh install with no
// scored sources yet (summary/sources 404) doesn't blank the whole page.
function useReliability() {
  const [summary, setSummary] = useState(null);
  const [sources, setSources] = useState([]);
  const [validationFlags, setValidationFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    const [summaryResult, sourcesResult, flagsResult] = await Promise.allSettled([
      getReliabilitySummary(),
      getReliabilitySources(),
      getValidationFlags(undefined, 25),
    ]);

    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    if (sourcesResult.status === "fulfilled") setSources(sourcesResult.value);
    if (flagsResult.status === "fulfilled") setValidationFlags(flagsResult.value);

    if (summaryResult.status === "rejected") {
      console.error(summaryResult.reason);
      setError(
        summaryResult.reason?.response?.data?.detail ||
        "No reliability data yet - run the pipeline (POST /system/run-pipeline) or wait for the scheduler."
      );
    } else {
      setError("");
    }

    setLoading(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // fetchAll's setState calls all happen after an `await`, so this is
    // the standard fetch-on-mount pattern, not a synchronous render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { summary, sources, validationFlags, loading, error, lastUpdated, refetch: fetchAll };
}

export default useReliability;
