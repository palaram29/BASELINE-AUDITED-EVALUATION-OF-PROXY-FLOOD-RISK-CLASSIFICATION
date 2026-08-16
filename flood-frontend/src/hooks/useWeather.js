import { useEffect, useState } from "react";
import { getLatestWeather } from "../services/weatherService";

function useWeather() {
  const [weather, setWeather] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        const data = await getLatestWeather();
        if (isMounted) setWeather(data);
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Failed to load weather data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();
    // Poll so this page reflects each automatic pipeline run (backend/
    // scheduler.py) without requiring a manual page reload.
    const interval = setInterval(fetchWeather, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { weather, loading, error };
}

export default useWeather;