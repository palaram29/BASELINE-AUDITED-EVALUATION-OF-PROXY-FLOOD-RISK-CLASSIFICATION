import { useMemo, useState } from "react";
import useRiver from "../../hooks/useRiver";
import usePrediction from "../../hooks/usePrediction";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import StatusTimeline from "../../components/charts/StatusTimeline";
import PredictionTable from "../../components/tables/PredictionTable";
import ViewToggle from "../../components/common/ViewToggle";
import { FLOOD_LEVELS, formatLevel } from "../../utils/riverLevels";

function River() {
  const { river, loading, error } = useRiver();
  const { prediction, error: predictionError } = usePrediction();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("live");

  const filteredRiver = useMemo(() => {
    const query = search.toLowerCase();
    return river.filter((item) => `${item.River} ${item.Station}`.toLowerCase().includes(query));
  }, [river, search]);

  if (loading) {
    return <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Loading river monitoring data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">River monitoring</h1>
          <p className="mt-2 text-slate-500">
            {view === "live"
              ? "Track water levels and flow risk across monitored stations."
              : "Next-day flood-risk prediction for each monitored city — a model output, not a river-level forecast."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <ViewToggle value={view} onChange={setView} />
          {view === "live" ? (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search river or station"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-80"
            />
          ) : null}
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {view === "live" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Observed stations</p>
                <h2 className="text-2xl font-semibold text-slate-800">{filteredRiver.length}</h2>
              </div>
              <Badge tone="blue">Updated</Badge>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left text-sm text-slate-600">
                    <th className="px-4 py-3">River</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Water level</th>
                    {FLOOD_LEVELS.map((level) => (
                      <th key={level.key} className="px-4 py-3">{level.label}</th>
                    ))}
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRiver.map((item, index) => (
                    <tr key={`${item.River}-${index}`} className="border-b border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-700">{item.River}</td>
                      <td className="px-4 py-3">{item.Station}</td>
                      <td className="px-4 py-3">{item.WaterLevel} m</td>
                      {FLOOD_LEVELS.map((level) => (
                        <td key={level.key} className={`px-4 py-3 ${level.tone}`}>
                          {formatLevel(item[level.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Badge tone={item.Status === "Alert" ? "red" : item.Status === "Watch" ? "yellow" : "green"}>{item.Status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <StatusTimeline river={filteredRiver} />
        </div>
      ) : (
        <>
          {predictionError ? <ErrorMessage message={predictionError} /> : null}
          <PredictionTable predictions={prediction} />
        </>
      )}
    </div>
  );
}

export default River;