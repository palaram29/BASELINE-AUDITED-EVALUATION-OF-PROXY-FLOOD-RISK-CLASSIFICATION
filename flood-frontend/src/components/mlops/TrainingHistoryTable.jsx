import { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";

const STATUS_TONE = { Production: "green", Candidate: "blue", Validation: "yellow", Archived: "slate" };

// Every registered version across every training run, newest first -
// real ml_model_versions rows (backend/services/mlops_service.py::
// get_training_history), same paginated-table pattern as
// ml/PredictionHistoryTable.jsx.
function TrainingHistoryTable({ trainingHistory = [] }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visible = trainingHistory.slice(0, visibleCount);

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Training History</h3>

      {trainingHistory.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-600">
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Algorithm</th>
                  <th className="px-4 py-3">Trained</th>
                  <th className="px-4 py-3">Macro-F1</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-slate-600">v{row.version}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.algorithm}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.trained_at ? new Date(row.trained_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.macro_f1 != null ? `${(row.macro_f1 * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.accuracy != null ? `${(row.accuracy * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[row.status] || "slate"}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCount < trainingHistory.length ? (
            <button
              onClick={() => setVisibleCount((count) => count + 10)}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Show more ({trainingHistory.length - visibleCount} remaining)
            </button>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No training runs registered yet"
          description="Run `python ML/train_models.py` then `python ML/register_run.py` to populate this table."
        />
      )}
    </Card>
  );
}

export default TrainingHistoryTable;
