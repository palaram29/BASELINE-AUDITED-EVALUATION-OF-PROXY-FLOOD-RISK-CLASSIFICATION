import Card from "../common/Card";
import Badge from "../common/Badge";

// Full metrics comparison table, with the best value in each column
// highlighted with a green badge.
const COLUMNS = [
  { key: "accuracy", label: "Accuracy", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "precision", label: "Precision", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "recall", label: "Recall", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "f1_score", label: "F1 Score", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "roc_auc", label: "ROC-AUC", format: (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "n/a") },
  { key: "training_time_sec", label: "Training Time", format: (v) => `${(v * 1000).toFixed(0)} ms`, lowerIsBetter: true },
  { key: "prediction_time_sec", label: "Prediction Time", format: (v) => `${(v * 1000).toFixed(1)} ms`, lowerIsBetter: true },
];

function bestValueFor(models, column) {
  const values = models.map((m) => m[column.key]).filter((v) => v != null);
  if (!values.length) return null;
  return column.lowerIsBetter ? Math.min(...values) : Math.max(...values);
}

function ModelComparisonTable({ models = [] }) {
  const bestValues = COLUMNS.map((column) => bestValueFor(models, column));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Model Comparison</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-600">
              <th className="px-4 py-3">Model</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.name} className="border-b border-slate-200">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default ModelComparisonTable;
