import { useEffect, useState } from "react";
import { getLatestWeather } from "../services/weatherService";

function useWeather() {
  const [weather, setWeather] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await getLatestWeather();
        setWeather(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load weather data.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  return { weather, loading, error };
}

export default useWeather;