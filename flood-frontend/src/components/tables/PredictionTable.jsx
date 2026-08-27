import { FiAlertTriangle, FiAlertOctagon, FiInfo, FiCheckCircle } from "react-icons/fi";
import { normalizeRisk } from "../../utils/riskLevels";
import Badge from "../common/Badge";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { RELIABILITY_TONE } from "../../utils/reliabilityTone";

// Predicted_Risk's real values are Low/Medium/High/Extreme (the ML model's
// training labels), not "Moderate" - a direct string comparison against
// "Moderate" left both Medium and Extreme predictions colored green.
const RISK_TEXT_CLASS = {
  "Very High": "text-red-600 dark:text-red-400",
  High: "text-orange-600 dark:text-orange-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Low: "text-emerald-600 dark:text-emerald-400",
};

// Icons give the risk level a second, color-independent signal so the
// forecast still reads correctly for colorblind users or on a bad screen.
const RISK_ICON = {
  "Very High": FiAlertOctagon,
  High: FiAlertTriangle,
  Medium: FiInfo,
  Low: FiCheckCircle,
};

function PredictionTable({ predictions = [] }) {
  return (
    <Card title="Latest flood-risk forecasts" subtitle="Next-day model output per monitored city">
      {predictions.length ? (
        <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>City</th>
                <th>3-day rainfall</th>
                <th>Temperature</th>
                <th>Wind speed</th>
                <th>Predicted for</th>
                <th>Predicted risk</th>
                <th>Data reliability</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((prediction, index) => {
                const risk = normalizeRisk(prediction.Predicted_Risk);
                const RiskIcon = RISK_ICON[risk] || FiInfo;
                return (
                  <tr
                    key={prediction.id ?? `${prediction.City}-${prediction.Predicted_For_Date}-${index}`}
                  >
                    <td>{prediction.City}</td>
                    <td>{prediction.Rainfall_3Day} mm</td>
                    <td>{prediction.Avg_Temperature} °C</td>
                    <td>{prediction.Avg_WindSpeed} km/h</td>
                    <td className="text-muted">{prediction.Predicted_For_Date || "—"}</td>
                    <td className={`font-semibold ${RISK_TEXT_CLASS[risk] || ""}`}>
                      <span className="flex items-center gap-1.5">
                        <RiskIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {prediction.Predicted_Risk}
                      </span>
                    </td>
                    <td>
                      {prediction.data_reliability_level ? (
                        <div className="flex items-center gap-2">
                          <Badge tone={RELIABILITY_TONE[prediction.data_reliability_level] || "slate"}>
                            {prediction.data_reliability_level}
                          </Badge>
                          {prediction.degraded_data_warning ? (
                            <span
                              className="text-xs font-medium text-red-600 dark:text-red-400"
                              title="Degraded environmental data behind this forecast"
                            >
                              ⚠ degraded
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No forecasts yet"
          description="Predictions will appear here once the next pipeline run completes."
        />
      )}
    </Card>
  );
}

export default PredictionTable;
