import { FiAlertTriangle, FiAlertOctagon, FiInfo, FiCheckCircle } from "react-icons/fi";
import { normalizeRisk } from "../../utils/riskLevels";
import Badge from "../common/Badge";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { RELIABILITY_TONE } from "../../utils/reliabilityTone";

// Same tier -> colour/icon mapping as components/tables/PredictionTable.jsx,
// kept identical so the "Today" index and the "Tomorrow" forecast read the
// same way. normalizeRisk() maps the rule's "Extreme" to "Very High".
const RISK_TEXT_CLASS = {
  "Very High": "text-red-600 dark:text-red-400",
  High: "text-orange-600 dark:text-orange-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Low: "text-emerald-600 dark:text-emerald-400",
};

const RISK_ICON = {
  "Very High": FiAlertOctagon,
  High: FiAlertTriangle,
  Medium: FiInfo,
  Low: FiCheckCircle,
};

// "Today" flood-risk index: the deterministic Hazard x Vulnerability rule
// scored on the latest live weather (backend/services/live_risk_service.py).
// This is NOT the ML model output - see PredictionTable for that.
function LiveRiskTable({ liveRisk = [] }) {
  return (
    <Card
      title="Today's flood-risk index"
      subtitle="Rule-based (rainfall x local exposure) — current conditions, not a model forecast"
    >
      {liveRisk.length ? (
        <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>City</th>
                <th>3-day rainfall</th>
                <th>Temperature</th>
                <th>Wind speed</th>
                <th>As of</th>
                <th>Risk index</th>
                <th>Data reliability</th>
              </tr>
            </thead>
            <tbody>
              {liveRisk.map((row, index) => {
                const risk = normalizeRisk(row.Risk_Level);
                const RiskIcon = RISK_ICON[risk] || FiInfo;
                return (
                  <tr key={row.id ?? `${row.City}-${row.Date}-${index}`}>
                    <td>{row.City}</td>
                    <td>{row.Rainfall_3Day != null ? `${row.Rainfall_3Day} mm` : "—"}</td>
                    <td>{row.Avg_Temperature != null ? `${row.Avg_Temperature} °C` : "—"}</td>
                    <td>{row.Avg_WindSpeed != null ? `${row.Avg_WindSpeed} km/h` : "—"}</td>
                    <td className="text-muted">{row.Date || "—"}</td>
                    <td className={`font-semibold ${RISK_TEXT_CLASS[risk] || ""}`}>
                      <span className="flex items-center gap-1.5">
                        <RiskIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {row.Risk_Level}
                      </span>
                    </td>
                    <td>
                      {row.data_reliability_level ? (
                        <div className="flex items-center gap-2">
                          <Badge tone={RELIABILITY_TONE[row.data_reliability_level] || "slate"}>
                            {row.data_reliability_level}
                          </Badge>
                          {row.degraded_data_warning ? (
                            <span
                              className="text-xs font-medium text-red-600 dark:text-red-400"
                              title="Degraded environmental data behind this index"
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
          title="No current-risk index yet"
          description="It will appear here once the pipeline has generated features for each city."
        />
      )}
    </Card>
  );
}

export default LiveRiskTable;
