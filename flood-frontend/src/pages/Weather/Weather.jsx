import { useMemo, useState } from "react";
import useWeather from "../../hooks/useWeather";
import WeatherHero from "../../components/weather/WeatherHero";
import WeatherSearch from "../../components/weather/WeatherSearch";
import WeatherForecastCard from "../../components/weather/WeatherForecastCard";
import WeatherChart from "../../components/weather/WeatherChart";
import WeatherTable from "../../components/weather/WeatherTable";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";

function Weather() {
  const { weather, loading, error } = useWeather();
  const [search, setSearch] = useState("");

  const filteredWeather = useMemo(() => {
    const query = search.toLowerCase();
    return weather.filter((item) => item.City.toLowerCase().includes(query));
  }, [weather, search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-800">Weather monitoring</h1>
            <Badge tone="blue">Live</Badge>
          </div>
          <p className="mt-2 text-slate-500">Latest weather conditions across Sri Lanka.</p>
        </div>
        <WeatherSearch onSearch={setSearch} />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <WeatherHero weather={filteredWeather} />

      <div className="grid gap-4 md:grid-cols-3">
        <WeatherForecastCard title="Rainfall outlook" value="High" detail="Heavy rain bands identified in coastal areas" tone="blue" />
        <WeatherForecastCard title="Temperature trend" value="28°C" detail="Warm conditions across inland districts" tone="yellow" />
        <WeatherForecastCard title="Wind activity" value="Moderate" detail="Crosswinds expected near mountain regions" tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WeatherChart weather={filteredWeather} />
        <WeatherTable weather={filteredWeather} />
      </div>
    </div>
  );
}

export default Weather;