import { useMemo, useState } from "react";
import usePrediction from "../../hooks/usePrediction";
import useWeather from "../../hooks/useWeather";
import useRiver from "../../hooks/useRiver";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import RiskChart from "../../components/charts/RiskChart";
import WeatherTable from "../../components/tables/WeatherTable";
import RiverTable from "../../components/tables/RiverTable";
import ViewToggle from "../../components/common/ViewToggle";
import { riskTone } from "../../utils/riskTone";

function Prediction() {
  const { prediction, loading, error } = usePrediction();
  const { weather, error: weatherError } = useWeather();
  const { river, error: riverError } = useRiver();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("tomorrow");

  const filteredPrediction = useMemo(() => {
    const query = search.toLowerCase();
    return prediction.filter((item) => item.City.toLowerCase().includes(query));
  }, [prediction, search]);

  if (loading) {
    return <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Loading prediction model output...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Flood risk forecast</h1>
          <p className="mt-2 text-slate-500">
            {view === "tomorrow"
              ? "Derived flood-risk index predicted for the next day, based on data available today for each monitored city."
              : "Live weather and river conditions currently feeding the forecast model."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <ViewToggle value={view} onChange={setView} />
          {view === "tomorrow" ? (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search city"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-80"
            />
          ) : null}
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {view === "tomorrow" ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left text-sm text-slate-600">
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Rainfall (3d)</th>
                    <th className="px-4 py-3">Temp</th>
                    <th className="px-4 py-3">Wind</th>
                    <th className="px-4 py-3">Predicted For</th>
                    <th className="px-4 py-3">Predicted Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrediction.map((item, index) => (
                    <tr key={`${item.City}-${index}`} className="border-b border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-700">{item.City}</td>
                      <td className="px-4 py-3">{item.Rainfall_3Day} mm</td>
                      <td className="px-4 py-3">{item.Avg_Temperature} °C</td>
                      <td className="px-4 py-3">{item.Avg_WindSpeed} km/h</td>
                      <td className="px-4 py-3 text-slate-500">{item.Predicted_For_Date || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={riskTone(item.Predicted_Risk)}>{item.Predicted_Risk}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <RiskChart prediction={filteredPrediction} />
        </div>
      ) : (
        <>
          {weatherError ? <ErrorMessage message={weatherError} /> : null}
          {riverError ? <ErrorMessage message={riverError} /> : null}
          <WeatherTable weather={weather} />
          <RiverTable rivers={river} />
        </>
      )}
    </div>
  );
}

export default Prediction;