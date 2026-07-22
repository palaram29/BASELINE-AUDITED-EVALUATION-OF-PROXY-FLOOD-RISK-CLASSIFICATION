import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardService";
import { demoWeather, demoRiver, demoPredictions } from "../utils/demoData";
import { simulateWeather, simulateRiver, simulatePrediction } from "../utils/liveData";

function useLiveDashboard() {
  const [dashboard, setDashboard] = useState({
    weather: demoWeather,
    river: demoRiver,
    prediction: demoPredictions,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        const data = await getDashboard();
        if (isMounted && data) {
          const weather = Array.isArray(data.weather) && data.weather.length ? simulateWeather(data.weather) : demoWeather;
          const river = Array.isArray(data.river) && data.river.length ? simulateRiver(data.river) : demoRiver;
          const prediction = Array.isArray(data.prediction) && data.prediction.length ? simulatePrediction(data.prediction) : demoPredictions;

          setDashboard({ weather, river, prediction });
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

    const interval = setInterval(() => {
      setDashboard((prev) => ({
        weather: simulateWeather(prev.weather),
        river: simulateRiver(prev.river),
        prediction: simulatePrediction(prev.prediction),
      }));
      setLastUpdated(new Date());
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { dashboard, loading, error, lastUpdated };
}

export default useLiveDashboard;
