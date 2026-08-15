import { FaTree, FaBolt, FaLayerGroup } from "react-icons/fa";
import Card from "../common/Card";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";

// One of the three overview cards (Random Forest / XGBoost / LightGBM)
// requested for the ML Dashboard: name, accuracy/precision/recall/F1,
// prediction & training time, and current status.
const ICONS = {
  RandomForest: FaTree,
  XGBoost: FaBolt,
  LightGBM: FaLayerGroup,
};

// Macro-F1 / High Recall / Extreme Recall are the actual selection
// criteria (ML/model_selector.py) - shown first. Accuracy is included
// for context but is deliberately NOT part of how "best" is chosen: a
// model can score ~96% accuracy while missing most High-risk days (see
// docs/ML_METHODOLOGY_AND_LIMITATIONS.md for why).
const metricRows = [
  { key: "macro_f1", label: "Macro-F1", tone: "blue" },
  { key: "high_risk_recall", label: "High Recall", tone: "yellow" },
  { key: "extreme_risk_recall", label: "Extreme Recall", tone: "yellow" },
  { key: "accuracy", label: "Accuracy", tone: "green" },
];

function ModelOverviewCard({ model, isBest = false }) {
  const Icon = ICONS[model.name] || FaLayerGroup;

  return (
    <Card
      className={`transition hover:-translate-y-1 hover:shadow-lg ${
        isBest ? "ring-2 ring-green-500" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon size={18} />
          </span>
          <h3 className="text-lg font-semibold text-slate-800">{model.name}</h3>
        </div>
        <Badge tone={model.status === "Trained" ? "green" : "slate"}>{model.status || "Unknown"}</Badge>
      </div>

      <div className="space-y-3">
        {metricRows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium text-slate-800">
                {model[row.key] != null ? `${(model[row.key] * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <ProgressBar value={model[row.key] || 0} tone={row.tone} />
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <p className="text-slate-500">Training Time</p>
          <p className="font-semibold text-slate-800">{(model.training_time_sec * 1000).toFixed(0)} ms</p>
        </div>
        <div>
          <p className="text-slate-500">Prediction Time</p>
          <p className="font-semibold text-slate-800">{(model.prediction_time_sec * 1000).toFixed(1)} ms</p>
        </div>
      </div>
    </Card>
  );
}

export default ModelOverviewCard;
