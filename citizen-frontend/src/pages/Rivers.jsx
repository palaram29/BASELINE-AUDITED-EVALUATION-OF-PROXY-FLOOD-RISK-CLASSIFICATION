import { useMemo, useState } from "react";
import { FiSearch, FiArrowUp, FiArrowDown, FiMinus } from "react-icons/fi";
import useLiveData from "../hooks/useLiveData";
import { getLatestRiver } from "../services/dataService";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Spinner from "../components/common/Spinner";
import ErrorMessage from "../components/common/ErrorMessage";
import DataFreshness from "../components/common/DataFreshness";
import { FLOOD_LEVELS, formatLevel } from "../utils/riverLevels";

const STATUS_TONE = {
  "Major Flood": "red",
  "Minor Flood": "orange",
  Alert: "amber",
  Normal: "green",
};

function Trend({ current, previous }) {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
  const delta = now - before;
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <FiMinus className="h-3.5 w-3.5" aria-hidden="true" /> Steady
      </span>
    );
  }
  const rising = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${rising ? "text-red-600" : "text-green-600"}`}
    >
      {rising ? (
        <FiArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <FiArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {rising ? "Rising" : "Falling"} {Math.abs(delta).toFixed(2)} m
    </span>
  );
}

function RiverCard({ item }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">{item.Station}</h3>
          <p className="text-xs text-slate-500">{item.River} river</p>
        </div>
        <Badge tone={STATUS_TONE[item.Status] || "slate"}>{item.Status || "Unknown"}</Badge>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">{formatLevel(item.WaterLevel)}</p>
          <p className="text-xs text-slate-500">Current water level</p>
        </div>
        <Trend current={item.WaterLevel} previous={item.PreviousWaterLevel} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
        {FLOOD_LEVELS.map((level) => (
          <div key={level.key}>
            <dt className="text-xs text-slate-500">{level.shortLabel}</dt>
            <dd className={`text-sm font-semibold ${level.tone}`}>
              {formatLevel(item[level.key])}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Rivers() {
  const [search, setSearch] = useState("");
  const { data, loading, error, lastUpdated, refresh } = useLiveData(getLatestRiver, {
    intervalMs: 60000,
    initial: [],
  });

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) =>
      `${item.River} ${item.Station}`.toLowerCase().includes(query)
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">River levels</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gauge readings from the Disaster Management Centre, with each river's alert and flood
            levels.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a river or station"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error ? <ErrorMessage message={error} onRetry={refresh} /> : null}

      {loading && !rows.length ? (
        <Spinner label="Loading river data…" />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            {search ? "No stations match your search." : "No river readings are available right now."}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <DataFreshness timestamp={lastUpdated} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item, index) => (
              <RiverCard key={`${item.River}-${item.Station}-${index}`} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Rivers;
