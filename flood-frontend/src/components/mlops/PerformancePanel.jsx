import Card from "../common/Card";
import Badge from "../common/Badge";

function pct(value) {
  return value != null ? `${(value * 100).toFixed(1)}%` : "—";
}

// Offline evaluation metrics only - honestly labeled, never presented as
// live accuracy. See docs/ML_METHODOLOGY_AND_LIMITATIONS.md §17.1: no
// historical or live flood-incident ground truth exists anywhere in
// this project, so a live accuracy/F1 can't be computed and this never
// fabricates one.
function PerformancePanel({ performance }) {
  if (!performance) return null;
  const metrics = performance.evaluation_metrics || {};

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-heading">Model Performance</h3>
        <Badge tone={performance.ground_truth_available ? "green" : "slate"}>
          {performance.ground_truth_available ? "Live ground truth" : "Offline evaluation only"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Accuracy</p>
          <p className="mt-1 text-lg font-semibold text-heading">{pct(metrics.accuracy)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Macro-F1</p>
          <p className="mt-1 text-lg font-semibold text-heading">{pct(metrics.macro_f1)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">High Recall</p>
          <p className="mt-1 text-lg font-semibold text-heading">{pct(metrics.high_risk_recall)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Extreme Recall</p>
          <p className="mt-1 text-lg font-semibold text-heading">{pct(metrics.extreme_risk_recall)}</p>
        </div>
      </div>

      {performance.note ? <p className="mt-4 text-xs text-muted">{performance.note}</p> : null}
    </Card>
  );
}

export default PerformancePanel;
