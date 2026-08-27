import Card from "../common/Card";

// Confusion matrix for the current best model, rendered as a CSS-grid
// heatmap (no image dependency - the backend already sends the raw
// counts in ML/reports/metrics.json).
function ConfusionMatrixView({ matrix = [], labels = [], modelName }) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-heading">Confusion Matrix</h3>
        <p className="text-sm text-muted">{modelName ? `${modelName} on the held-out test set` : "Best model on the held-out test set"}</p>
      </div>

      {matrix.length ? (
        <div className="overflow-x-auto">
          <table className="border-collapse text-center text-sm">
            <thead>
              <tr>
                <th className="p-2" colSpan={2}></th>
                <th className="p-2 text-xs font-medium uppercase text-muted" colSpan={labels.length}>Predicted</th>
              </tr>
              <tr>
                <th className="p-2" colSpan={2}></th>
                {labels.map((label) => (
                  <th key={label} className="p-2 text-xs font-medium text-muted">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={labels[i]}>
                  {i === 0 ? (
                    <th
                      rowSpan={matrix.length}
                      className="p-2 text-xs font-medium uppercase text-muted [writing-mode:vertical-rl]"
                    >
                      Actual
                    </th>
                  ) : null}
                  <th className="whitespace-nowrap p-2 text-right text-xs font-medium text-muted">
                    {labels[i]}
                  </th>
                  {row.map((value, j) => {
                    const intensity = value / max;
                    return (
                      <td
                        key={`${i}-${j}`}
                        className="h-14 w-14 border border-white font-semibold text-heading"
                        style={{ backgroundColor: `rgba(37, 99, 235, ${0.08 + intensity * 0.55})` }}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-faint">No confusion matrix available.</p>
      )}
    </Card>
  );
}

export default ConfusionMatrixView;
