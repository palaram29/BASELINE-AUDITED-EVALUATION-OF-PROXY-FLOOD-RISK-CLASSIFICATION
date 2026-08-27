import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardService";
import { demoWeather, demoRiver, demoPredictions, demoLiveRisk } from "../utils/demoData";
import { simulateWeather, simulateRiver, simulatePrediction, simulateLiveRisk } from "../utils/liveData";

function useLiveDashboard() {
  const [dashboard, setDashboard] = useState({
    weather: demoWeather,
    river: demoRiver,
    prediction: demoPredictions,
    liveRisk: demoLiveRisk,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      if (isMounted) setLoading(true);

      try {
        const data = await getDashboard();
        if (isMounted && data) {
          // A genuine response is shown as-is - including any genuinely
          // empty arrays - never silently swapped for demo data. The
          // simulate*/demo fallback below is reserved for when the
          // backend is actually unreachable (visibly labeled via `error`).
          const weather = Array.isArray(data.weather) ? data.weather : [];
          const river = Array.isArray(data.river) ? data.river : [];
          const prediction = Array.isArray(data.prediction) ? data.prediction : [];
          const liveRisk = Array.isArray(data.live_risk) ? data.live_risk : [];

          setDashboard({ weather, river, prediction, liveRisk });
          setLastUpdated(new Date());
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Live backend is unavailable. Showing simulated live data.");
          setDashboard({
            weather: simulateWeather(demoWeather),
            river: simulateRiver(demoRiver),
            prediction: simulatePrediction(demoPredictions),
            liveRisk: simulateLiveRisk(demoLiveRisk),
          });
          setLastUpdated(new Date());
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    // Poll the real backend so the dashboard reflects genuine changes
    // (e.g. a new pipeline run) instead of only refreshing on page reload.
    const interval = setInterval(fetchDashboard, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [retryToken]);

  const retry = () => setRetryToken((token) => token + 1);

  return { dashboard, loading, error, lastUpdated, retry };
}

export default useLiveDashboard;
