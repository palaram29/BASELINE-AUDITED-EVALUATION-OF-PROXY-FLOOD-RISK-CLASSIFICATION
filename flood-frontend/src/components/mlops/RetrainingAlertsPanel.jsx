import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";

const EVENT_TONE = { drift_alert: "yellow", quality_alert: "yellow", performance_alert: "orange", promotion: "green" };
const EVENT_LABEL = {
  drift_alert: "Feature Drift Alert",
  quality_alert: "Data Quality Alert",
  performance_alert: "Performance Alert",
  promotion: "Model Promoted",
};

// Alert/promotion log (ml_retraining_events). A breach only ever logs
// here - it is never wired to an automatic retrain, per
// docs/ML_METHODOLOGY_AND_LIMITATIONS.md's frozen-model policy. A human
// still runs `python ML/train_models.py` and reviews the result.
function RetrainingAlertsPanel({ retrainingStatus }) {
  const events = retrainingStatus?.events || [];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Retraining Alerts</h3>
        {retrainingStatus?.retraining_recommended ? <Badge tone="orange">Retraining recommended</Badge> : null}
      </div>

      {events.length ? (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-700">{EVENT_LABEL[e.event_type] || e.event_type}</p>
                <p className="text-xs text-slate-500">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ""} · triggered by {e.triggered_by}
                </p>
              </div>
              <Badge tone={EVENT_TONE[e.event_type] || "slate"}>{e.event_type}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No retraining events yet" description="Drift/quality breaches and promotions will be logged here." />
      )}

      {retrainingStatus?.note ? <p className="mt-4 text-xs text-slate-400">{retrainingStatus.note}</p> : null}
    </Card>
  );
}

export default RetrainingAlertsPanel;
