import { useMemo, useState } from "react";
import useWeather from "../../hooks/useWeather";
import usePrediction from "../../hooks/usePrediction";
import PageHeader from "../../components/common/PageHeader";
import WeatherHero from "../../components/weather/WeatherHero";
import WeatherSearch from "../../components/weather/WeatherSearch";
import WeatherForecastCard from "../../components/weather/WeatherForecastCard";
import WeatherChart from "../../components/weather/WeatherChart";
import WeatherTable from "../../components/tables/WeatherTable";
import PredictionTable from "../../components/tables/PredictionTable";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import ViewToggle from "../../components/common/ViewToggle";
import Skeleton from "../../components/common/Skeleton";

function Weather() {
  const { weather, loading, error } = useWeather();
  const { prediction, error: predictionError } = usePrediction();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("live");

  const filteredWeather = useMemo(() => {
    const query = search.toLowerCase();
    return weather.filter((item) => item.City.toLowerCase().includes(query));
  }, [weather, search]);

  const filteredPrediction = useMemo(() => {
    const query = search.toLowerCase();
    return prediction.filter((item) => item.City.toLowerCase().includes(query));
  }, [prediction, search]);

  // Real summary stats computed from the same observed rows shown below.
  const summary = useMemo(() => {
    if (!filteredWeather.length) return null;
    const wettest = filteredWeather.reduce((a, b) => (b.Rainfall > a.Rainfall ? b : a));
    const windiest = filteredWeather.reduce((a, b) => (b.WindSpeed > a.WindSpeed ? b : a));
    const avgTemp =
      filteredWeather.reduce((sum, item) => sum + item.Temperature, 0) / filteredWeather.length;
    return { wettest, windiest, avgTemp };
  }, [filteredWeather]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monitoring"
        title="Weather monitoring"
        badge={<Badge tone={error ? "red" : "green"} dot>{error ? "Offline" : "Live"}</Badge>}
        description={
          view === "live"
            ? "Latest observed weather conditions across monitored districts in Sri Lanka."
            : "Next-day flood-risk prediction for each monitored city — a model output, not a weather forecast."
        }
        actions={<ViewToggle value={view} onChange={setView} />}
      >
        <WeatherSearch onSearch={setSearch} />
      </PageHeader>

      {error ? <ErrorMessage message={error} /> : null}

      {view === "live" ? (
        <>
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
                detail={`Across ${filteredWeather.length} monitored ${
                  filteredWeather.length === 1 ? "city" : "cities"
                }`}
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

          <div className="space-y-6">
            <WeatherChart weather={filteredWeather} />
            <WeatherTable weather={filteredWeather} />
          </div>
        </>
      ) : (
        <>
          {predictionError ? <ErrorMessage message={predictionError} /> : null}
          <PredictionTable predictions={filteredPrediction} />
        </>
      )}
    </div>
  );
}

export default Weather;
