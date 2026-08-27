import { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { riskTone } from "../../utils/riskTone";

// "Prediction History" table: Date, Predicted For, City, Flood Risk,
// Probability, Model Used. "Date" is when the underlying features were
// observed; "Predicted For" is the day the risk label actually applies
// to (Date + 1) - see docs/ML_METHODOLOGY_AND_LIMITATIONS.md. Keeping
// both columns distinct avoids implying the risk badge describes a
// condition already observed on "Date".
function PredictionHistoryTable({ history = [] }) {
  const [visibleCount, setVisibleCount] = useState(15);
  const visible = history.slice(0, visibleCount);

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-heading">Prediction History</h3>

      {history.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-surface-2 text-left text-sm text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Predicted For</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Predicted Risk</th>
                  <th className="px-4 py-3">Probability</th>
                  <th className="px-4 py-3">Model Used</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={`${row.City}-${row.Date}-${index}`} className="border-b border-line text-sm">
                    <td className="px-4 py-3 text-muted">{row.Date}</td>
                    <td className="px-4 py-3 text-muted">{row.Predicted_For_Date || "—"}</td>
                    <td className="px-4 py-3 font-medium text-body">{row.City}</td>
                    <td className="px-4 py-3"><Badge tone={riskTone(row.Predicted_Risk)}>{row.Predicted_Risk}</Badge></td>
                    <td className="px-4 py-3 text-muted">
                      {row.Probability != null ? `${(row.Probability * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.Model_Used || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCount < history.length ? (
            <button
              onClick={() => setVisibleCount((count) => count + 15)}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Show more ({history.length - visibleCount} remaining)
            </button>
          ) : null}
        </>
      ) : (
        <EmptyState title="No predictions yet" description="Run a live prediction above or trigger the pipeline to populate this table." />
      )}
    </Card>
  );
}

export default PredictionHistoryTable;
