import { useState } from "react";
import useWeather from "../../hooks/useWeather";

import WeatherStats from "../../components/weather/WeatherStats";
import WeatherSearch from "../../components/weather/WeatherSearch";
import WeatherChart from "../../components/weather/WeatherChart";
import WeatherTable from "../../components/weather/WeatherTable";

function Weather() {
  const { weather, loading, error } = useWeather();

  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg font-medium text-slate-600">
          Loading weather data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg font-medium text-red-600">
          {error}
        </p>
      </div>
    );
  }

  const filteredWeather = weather.filter((item) =>
    item.City.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Weather Monitoring
        </h1>

        <p className="text-slate-500 mt-2">
          Latest weather conditions across Sri Lanka
        </p>
      </div>

      {/* Weather Statistics */}
      <WeatherStats weather={filteredWeather} />

      {/* Search */}
      <WeatherSearch onSearch={setSearch} />

      {/* Rainfall Chart */}
      <WeatherChart weather={filteredWeather} />

      {/* Weather Table */}
      <WeatherTable weather={filteredWeather} />

    </div>
  );
}

export default Weather;