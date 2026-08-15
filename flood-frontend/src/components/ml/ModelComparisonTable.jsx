import Card from "../common/Card";
import Badge from "../common/Badge";

// Full metrics comparison table, with the best value in each column
// highlighted with a green badge.
//
// Macro-F1 / High Recall / Extreme Recall come first because those are
// the actual model-selection criteria (ML/model_selector.py's
// select_best_model - see docs/ML_METHODOLOGY_AND_LIMITATIONS.md).
// Accuracy/Precision/Recall/F1 Score below are the WEIGHTED-average
// versions - dominated by the ~95% "Low" class, so a model can score
// very high on these while being weak on the High/Extreme classes that
// actually matter for an early-warning system. Shown for context only,
// never used to auto-highlight "best" the way they used to be.
const COLUMNS = [
  { key: "macro_f1", label: "Macro-F1", format: (v) => `${(v * 100).toFixed(1)}%`, primary: true },
  { key: "high_risk_recall", label: "High Recall", format: (v) => `${(v * 100).toFixed(1)}%`, primary: true },
  { key: "extreme_risk_recall", label: "Extreme Recall", format: (v) => `${(v * 100).toFixed(1)}%`, primary: true },
  { key: "accuracy", label: "Accuracy", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "f1_score", label: "Weighted F1", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "roc_auc", label: "ROC-AUC", format: (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "n/a") },
  { key: "training_time_sec", label: "Training Time", format: (v) => `${(v * 1000).toFixed(0)} ms`, lowerIsBetter: true },
  { key: "prediction_time_sec", label: "Prediction Time", format: (v) => `${(v * 1000).toFixed(1)} ms`, lowerIsBetter: true },
];

function bestValueFor(models, column) {
  const values = models.map((m) => m[column.key]).filter((v) => v != null);
  if (!values.length) return null;
  return column.lowerIsBetter ? Math.min(...values) : Math.max(...values);
}

function ModelComparisonTable({ models = [], bestModelName }) {
  const bestValues = COLUMNS.map((column) => bestValueFor(models, column));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Model Comparison</h3>
      <p className="mb-4 text-sm text-slate-500">
        Green badges mark the highest value in each column. That is not always the model actually{" "}
        <strong>selected</strong> (right-most column) - selection weighs Macro-F1, High Recall and Extreme Recall
        together (see the Best Performing Model panel for the exact reasoning), not any single column in isolation.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-600">
              <th className="px-4 py-3">Model</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3">{column.label}</th>
              ))}
              <th className="px-4 py-3">Selected</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={model.name}
                className={`border-b border-slate-200 ${model.name === bestModelName ? "bg-green-50/60" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-slate-700">{model.name}</td>
                {COLUMNS.map((column, index) => {
                  const value = model[column.key];
                  const isBest = value != null && value === bestValues[index];
                  return (
                    <td key={column.key} className="px-4 py-3">
                      {isBest ? (
                        <Badge tone="green">{column.format(value)}</Badge>
                      ) : (
                        <span className="text-slate-700">{value != null ? column.format(value) : "n/a"}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3">
                  {model.name === bestModelName ? <Badge tone="green">Selected</Badge> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default ModelComparisonTable;
