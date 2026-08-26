import { useMemo, useState } from "react";
import { FiDroplet, FiWind, FiThermometer, FiSearch } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useLiveData from "../hooks/useLiveData";
import { getLatestWeather } from "../services/dataService";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import ErrorMessage from "../components/common/ErrorMessage";
import DataFreshness from "../components/common/DataFreshness";

function WeatherRow({ item, highlight }) {
  return (
    <Card className={highlight ? "border-blue-300 ring-1 ring-blue-200" : ""}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{item.City}</h3>
        {highlight ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Your area
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2">
          <FiDroplet className="h-4 w-4 text-blue-500" aria-hidden="true" />
          <span className="font-semibold text-slate-800">{item.Rainfall ?? "—"} mm</span>
          <span className="text-xs text-slate-500">Rainfall</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2">
          <FiThermometer className="h-4 w-4 text-orange-500" aria-hidden="true" />
          <span className="font-semibold text-slate-800">{item.Temperature ?? "—"}°C</span>
          <span className="text-xs text-slate-500">Temp</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2">
          <FiWind className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="font-semibold text-slate-800">{item.WindSpeed ?? "—"} km/h</span>
          <span className="text-xs text-slate-500">Wind</span>
        </div>
      </div>
    </Card>
  );
}

function Weather() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { data, loading, error, lastUpdated, refresh } = useLiveData(getLatestWeather, {
    intervalMs: 60000,
    initial: [],
  });

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? list.filter((item) => item.City?.toLowerCase().includes(query))
      : list;
    // Pin the user's area to the top.
    if (!user?.alert_city) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.City === user.alert_city) return -1;
      if (b.City === user.alert_city) return 1;
      return 0;
    });
  }, [data, search, user]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Weather now</h1>
          <p className="mt-1 text-sm text-slate-500">Latest observed conditions across Sri Lanka.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a city"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error ? <ErrorMessage message={error} onRetry={refresh} /> : null}

      {loading && !rows.length ? (
        <Spinner label="Loading weather…" />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No weather readings match your search.</p>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <DataFreshness timestamp={lastUpdated} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <WeatherRow
                key={item.City}
                item={item}
                highlight={user?.alert_city === item.City}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Weather;
