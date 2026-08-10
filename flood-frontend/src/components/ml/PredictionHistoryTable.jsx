import { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { riskTone } from "../../utils/riskTone";

// "Prediction History" table: Date, City, Flood Risk, Probability, Model Used.
function PredictionHistoryTable({ history = [] }) {
  const [visibleCount, setVisibleCount] = useState(15);
  const visible = history.slice(0, visibleCount);

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Prediction History</h3>

      {history.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left text-sm text-slate-600">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Flood Risk</th>
                  <th className="px-4 py-3">Probability</th>
                  <th className="px-4 py-3">Model Used</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={`${row.City}-${row.Date}-${index}`} className="border-b border-slate-200 text-sm">
                    <td className="px-4 py-3 text-slate-600">{row.Date}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.City}</td>
                    <td className="px-4 py-3"><Badge tone={riskTone(row.Predicted_Risk)}>{row.Predicted_Risk}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.Probability != null ? `${(row.Probability * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.Model_Used || "—"}</td>
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
