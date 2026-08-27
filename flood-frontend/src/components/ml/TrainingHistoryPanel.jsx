import Card from "../common/Card";

// "Training History" section: last training date, dataset size,
// training duration, best model selected.
function TrainingHistoryPanel({ bestModel }) {
  if (!bestModel) return null;

  const trainedAt = bestModel.trained_at ? new Date(bestModel.trained_at) : null;
  const totalRows = bestModel.dataset ? bestModel.dataset.train_rows + bestModel.dataset.test_rows : null;

  const rows = [
    { label: "Last Training Date", value: trainedAt ? trainedAt.toLocaleString() : "—" },
    {
      label: "Dataset Size",
      value: bestModel.dataset
        ? `${totalRows} rows (${bestModel.dataset.train_rows} train / ${bestModel.dataset.test_rows} test)`
        : "—",
    },
    {
      label: "Training Duration",
      value: bestModel.training_duration_sec != null ? `${bestModel.training_duration_sec.toFixed(2)}s` : "—",
    },
    { label: "Best Model Selected", value: bestModel.name },
  ];

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-heading">Training History</h3>
      <dl className="space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
            <dt className="text-muted">{row.label}</dt>
            <dd className="font-medium text-heading">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default TrainingHistoryPanel;
