import { useMemo, useState } from "react";
import usePrediction from "../../hooks/usePrediction";
import useLiveRisk from "../../hooks/useLiveRisk";
import useTomorrowComparison from "../../hooks/useTomorrowComparison";
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
  const { comparison } = useTomorrowComparison();
  const { weather, error: weatherError } = useWeather();
  const { river, error: riverError } = useRiver();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("tomorrow");

  const filteredPrediction = useMemo(() => {
    const query = search.toLowerCase();
    return prediction.filter((item) => item.City.toLowerCase().includes(query));
  }, [prediction, search]);

  // City -> persistence forecast, joined onto the existing ML-sourced
  // filteredPrediction rows below rather than replacing them, so a
  // comparison-endpoint outage degrades to "no persistence column" instead
  // of losing the whole table.
  const persistenceByCity = useMemo(() => {
    const map = {};
    comparison.forEach((row) => {
      map[row.City] = row.Persistence_Forecast;
    });
    return map;
  }, [comparison]);

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
          <Card title="Predicted risk by city" subtitle="Persistence baseline vs. the frozen ML model, next-day">
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
                      <th>Persistence forecast</th>
                      <th>ML forecast (experimental)</th>
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
                          {persistenceByCity[item.City] ? (
                            <Badge tone={riskTone(persistenceByCity[item.City])}>
                              {persistenceByCity[item.City]}
                            </Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
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

          <p className="text-xs text-muted">
            Across the primary evaluation split, six walk-forward folds, a target-sensitivity
            sweep, and a duplicate-series robustness check, the persistence baseline has
            outperformed the frozen ML model on macro-F1 in every test run to date (see
            docs/ML_METHODOLOGY_AND_LIMITATIONS.md). The ML forecast is retained here for
            monitoring and future retraining decisions, not as the recommended figure.
          </p>

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
