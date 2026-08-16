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

  // Real summary stats computed from the same observed rows shown below -
  // these used to be hardcoded placeholder text ("Heavy rain bands
  // identified in coastal areas", etc.) unrelated to the actual data.
  const summary = useMemo(() => {
    if (!filteredWeather.length) return null;

    const wettest = filteredWeather.reduce((a, b) => (b.Rainfall > a.Rainfall ? b : a));
    const windiest = filteredWeather.reduce((a, b) => (b.WindSpeed > a.WindSpeed ? b : a));
    const avgTemp = filteredWeather.reduce((sum, item) => sum + item.Temperature, 0) / filteredWeather.length;

    return { wettest, windiest, avgTemp };
  }, [filteredWeather]);

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
            <Badge tone={error ? "red" : "blue"}>{error ? "Offline" : "Live"}</Badge>
          </div>
          <p className="mt-2 text-slate-500">Latest weather conditions across Sri Lanka.</p>
        </div>
        <WeatherSearch onSearch={setSearch} />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <WeatherHero weather={filteredWeather} />

      {summary ? (
        <div className="grid gap-4 md:grid-cols-3">
          <WeatherForecastCard
            title="Highest rainfall"
            value={`${summary.wettest.Rainfall} mm`}
            detail={`${summary.wettest.City}, observed today`}
            tone="blue"
          />
          <WeatherForecastCard
            title="Average temperature"
            value={`${summary.avgTemp.toFixed(1)}°C`}
            detail={`Across ${filteredWeather.length} monitored ${filteredWeather.length === 1 ? "city" : "cities"}`}
            tone="yellow"
          />
          <WeatherForecastCard
            title="Highest wind speed"
            value={`${summary.windiest.WindSpeed} km/h`}
            detail={`${summary.windiest.City}, observed today`}
            tone="green"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WeatherChart weather={filteredWeather} />
        <WeatherTable weather={filteredWeather} />
      </div>
    </div>
  );
}

export default Weather;