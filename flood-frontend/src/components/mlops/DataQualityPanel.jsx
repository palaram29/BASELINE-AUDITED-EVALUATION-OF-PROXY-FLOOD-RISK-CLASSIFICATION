import Card from "../common/Card";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";
import EmptyState from "../common/EmptyState";

const STATUS_TONE = { NORMAL: "green", WARNING: "yellow", CRITICAL: "red", UNKNOWN: "slate" };
const PROGRESS_TONE = { NORMAL: "green", WARNING: "yellow", CRITICAL: "slate", UNKNOWN: "slate" };

function metricLabel(name) {
  return name
    .replace(/_pct$/, "")
    .replace(/^missing_rate_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// The data-quality/"reliability score" section. Nothing like this
// existed in the codebase before (verified during exploration) - this
// is the first and only such score, computed live from weather_data/
// river_data null rates and city coverage (backend/services/
// mlops_service.py::compute_data_quality_metrics), never fabricated.
function DataQualityPanel({ dataQuality }) {
  const metrics = dataQuality?.metrics || [];
  const reliability = metrics.find((m) => m.metric_name === "data_reliability_score");
  const others = metrics.filter((m) => m.metric_name !== "data_reliability_score");

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Data Quality</h3>
        {dataQuality?.overall_status ? (
          <Badge tone={STATUS_TONE[dataQuality.overall_status] || "slate"}>{dataQuality.overall_status}</Badge>
        ) : null}
      </div>

      {metrics.length ? (
        <div className="space-y-4">
          {reliability ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">Data Reliability Score</span>
                <span className="font-semibold text-slate-800">
                  {reliability.metric_value != null ? `${reliability.metric_value.toFixed(1)}%` : "—"}
                </span>
              </div>
              <ProgressBar
                value={(reliability.metric_value || 0) / 100}
                tone={PROGRESS_TONE[reliability.status] || "slate"}
              />
            </div>
          ) : null}

          <table className="min-w-full text-sm">
            <tbody>
              {others.map((m) => (
                <tr key={m.metric_name} className="border-t border-slate-100">
                  <td className="px-2 py-2 text-slate-600">{metricLabel(m.metric_name)}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-800">
                    {m.metric_value != null ? `${m.metric_value.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Badge tone={STATUS_TONE[m.status] || "slate"}>{m.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No data-quality snapshots yet"
          description="These populate after the first scheduled pipeline run."
        />
      )}
    </Card>
  );
}

export default DataQualityPanel;
