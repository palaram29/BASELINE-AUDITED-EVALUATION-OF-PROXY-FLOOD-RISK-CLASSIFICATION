import { useMemo, useState } from "react";
import usePrediction from "../../hooks/usePrediction";
import useLiveRisk from "../../hooks/useLiveRisk";
import useWeather from "../../hooks/useWeather";
import useRiver from "../../hooks/useRiver";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import Loader from "../../components/common/Loader";
import SearchInput from "../../components/common/SearchInput";
import EmptyState from "../../components/common/EmptyState";
import RiskChart from "../../components/charts/RiskChart";
import LiveRiskTable from "../../components/prediction/LiveRiskTable";
import LiveRiskOverview from "../../components/prediction/LiveRiskOverview";
import WeatherTable from "../../components/tables/WeatherTable";
import RiverTable from "../../components/tables/RiverTable";
import ViewToggle from "../../components/common/ViewToggle";
import { riskTone } from "../../utils/riskTone";

function Prediction() {
  const { prediction, loading, error } = usePrediction();
  const { liveRisk, error: liveRiskError } = useLiveRisk();
  const { weather, error: weatherError } = useWeather();
  const { river, error: riverError } = useRiver();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("tomorrow");

  const filteredPrediction = useMemo(() => {
    const query = search.toLowerCase();
    return prediction.filter((item) => item.City.toLowerCase().includes(query));
  }, [prediction, search]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monitoring"
        title="Flood-risk forecast"
        description={
          view === "tomorrow"
            ? "The frozen production model's next-day flood-risk index for each monitored city, scored on data available today."
            : "A rule-based flood-risk index for right now — current rainfall × each city's fixed flood exposure — plus the live weather and river conditions feeding the model. Not a model forecast."
        }
        actions={<ViewToggle value={view} onChange={setView} liveLabel="Today" tomorrowLabel="Tomorrow" />}
      >
        {view === "tomorrow" ? (
          <SearchInput value={search} placeholder="Search city" onSearch={setSearch} />
        ) : null}
      </PageHeader>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <Card>
          <Loader label="Loading prediction model output…" />
        </Card>
      ) : view === "tomorrow" ? (
        <div className="space-y-6">
          <Card title="Predicted risk by city" subtitle="Next-day flood-risk tier">
            {filteredPrediction.length ? (
              <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>City</th>
                      <th>Rainfall (3d)</th>
                      <th>Temp</th>
                      <th>Wind</th>
                      <th>Predicted for</th>
                      <th>Predicted risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrediction.map((item, index) => (
                      <tr key={`${item.City}-${index}`}>
                        <td>{item.City}</td>
                        <td>{item.Rainfall_3Day} mm</td>
                        <td>{item.Avg_Temperature} °C</td>
                        <td>{item.Avg_WindSpeed} km/h</td>
                        <td className="text-muted">{item.Predicted_For_Date || "—"}</td>
                        <td>
                          <Badge tone={riskTone(item.Predicted_Risk)}>{item.Predicted_Risk}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No forecasts" description="No prediction matches that search yet." />
            )}
          </Card>

          <RiskChart prediction={filteredPrediction} />
        </div>
      ) : (
        <>
          {liveRiskError ? <ErrorMessage message={liveRiskError} /> : null}
          {weatherError ? <ErrorMessage message={weatherError} /> : null}
          {riverError ? <ErrorMessage message={riverError} /> : null}
          <LiveRiskOverview liveRisk={liveRisk} />
          <LiveRiskTable liveRisk={liveRisk} />
          <WeatherTable weather={weather} />
          <RiverTable rivers={river} />
        </>
      )}
    </div>
  );
}

export default Prediction;
