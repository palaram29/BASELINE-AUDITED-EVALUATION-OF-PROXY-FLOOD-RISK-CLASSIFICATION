import { FaTrophy } from "react-icons/fa";
import Card from "../common/Card";
import Badge from "../common/Badge";

// Large highlighted "Best Performing Model" panel.
function BestModelPanel({ bestModel }) {
  if (!bestModel) return null;

  const trainedAt = bestModel.trained_at ? new Date(bestModel.trained_at) : null;

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600">
              <FaTrophy size={22} />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-green-700">Best Performing Model</p>
              <h2 className="text-2xl font-bold text-heading">{bestModel.name}</h2>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm text-muted">{bestModel.reason_selected}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="green">Used for ML Flood-Risk Prediction</Badge>
            {bestModel.production_status === "frozen" ? (
              <Badge tone="slate">
                Frozen{bestModel.production_version ? ` v${bestModel.production_version}` : ""} — not retrained live
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          <Stat label="Macro-F1" value={`${(bestModel.macro_f1 * 100).toFixed(1)}%`} />
          <Stat label="High Recall" value={`${(bestModel.high_risk_recall * 100).toFixed(1)}%`} />
          <Stat label="Extreme Recall" value={`${(bestModel.extreme_risk_recall * 100).toFixed(1)}%`} />
          <Stat label="Accuracy" value={`${(bestModel.accuracy * 100).toFixed(1)}%`} />
          <Stat label="Training Time" value={`${(bestModel.training_time_sec * 1000).toFixed(0)} ms`} />
          <Stat
            label="Date Trained"
            value={trainedAt ? trainedAt.toLocaleDateString() : "—"}
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-heading">{value}</p>
    </div>
  );
}

export default BestModelPanel;
