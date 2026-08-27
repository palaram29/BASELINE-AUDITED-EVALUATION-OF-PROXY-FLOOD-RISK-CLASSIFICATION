import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useLiveData from "../hooks/useLiveData";
import { getLatestPrediction, getLiveRisk } from "../services/dataService";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Spinner from "../components/common/Spinner";
import ErrorMessage from "../components/common/ErrorMessage";
import DataFreshness from "../components/common/DataFreshness";
import ViewToggle from "../components/common/ViewToggle";
import { normalizeRisk, riskLabel, riskRank } from "../utils/risk";
import { formatDate } from "../utils/format";

const TONE = { Low: "green", Medium: "amber", High: "orange", "Very High": "red" };

function Forecast() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("tomorrow");

  const tomorrow = useLiveData(getLatestPrediction, { intervalMs: 60000, initial: [] });
  const today = useLiveData(getLiveRisk, { intervalMs: 60000, initial: [] });
  const active = view === "today" ? today : tomorrow;
  const { data, loading, error, lastUpdated, refresh } = active;

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? list.filter((item) => item.City?.toLowerCase().includes(query))
      : list;
    return [...filtered]
      .map((item) => ({
        City: item.City,
        rawRisk: view === "today" ? item.Risk_Level : item.Predicted_Risk,
        rainfall: item.Rainfall_3Day,
      }))
      .sort((a, b) => {
        const byRisk = riskRank(normalizeRisk(b.rawRisk)) - riskRank(normalizeRisk(a.rawRisk));
        if (byRisk !== 0) return byRisk;
        return (a.City || "").localeCompare(b.City || "");
      });
  }, [data, search, view]);

  const forecastDate = view === "tomorrow"
    ? (Array.isArray(data) ? data.find((row) => row.Predicted_For_Date)?.Predicted_For_Date : null)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">
            {view === "today" ? "Flood risk right now" : "Tomorrow's flood risk"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === "today"
              ? "A rule-based risk index from current rainfall and each area's flood exposure. Not a model prediction, and not an official warning."
              : `A next-day risk forecast from the prediction model${forecastDate ? ` for ${formatDate(forecastDate)}` : ""}. Not an official warning.`}
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} />
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

      {error ? <ErrorMessage message={error} onRetry={refresh} /> : null}

      {loading && !rows.length ? (
        <Spinner label="Loading the forecast…" />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            {view === "today"
              ? "No current risk index is available right now."
              : "No forecast is available right now."}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <DataFreshness timestamp={lastUpdated} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => {
              const risk = normalizeRisk(item.rawRisk);
              const mine = user?.alert_city === item.City;
              return (
                <div
                  key={item.City}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    mine ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {item.City}
                      {mine ? (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Your area
                        </span>
                      ) : null}
                    </p>
                    {item.rainfall != null ? (
                      <p className="text-xs text-slate-500">
                        {item.rainfall} mm rain {view === "today" ? "in the last 3 days" : "in the 3-day forecast"}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={TONE[risk]}>{riskLabel(risk)}</Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Forecast;
