import useWeather from "../../hooks/useWeather";

import WeatherStats from "../../components/weather/WeatherStats";
import WeatherSearch from "../../components/weather/WeatherSearch";
import WeatherChart from "../../components/weather/WeatherChart";
import WeatherTable from "../../components/weather/WeatherTable";

function Weather() {
  const { weather, loading, error } = useWeather();

  if (loading) {
    return <div className="text-center p-8">Loading weather data...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-8">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Weather Monitoring</h1>

        <p className="text-slate-500">
          Latest weather conditions across Sri Lanka
        </p>
      </div>

      <WeatherStats weather={weather} />

      <WeatherSearch />

      <WeatherChart weather={weather} />

      <WeatherTable weather={weather} />
    </div>
  );
}

export default Weather;