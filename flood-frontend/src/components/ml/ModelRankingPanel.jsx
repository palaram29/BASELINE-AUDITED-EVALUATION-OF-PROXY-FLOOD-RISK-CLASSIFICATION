import Card from "../common/Card";

const MEDALS = ["🥇", "🥈", "🥉"];

// Ranking panel, sorted by F1 Score every time `models` changes (i.e.
// automatically after each training run).
function ModelRankingPanel({ models = [] }) {
  const ranked = [...models].sort((a, b) => (b.f1_score || 0) - (a.f1_score || 0));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Model Ranking</h3>
      <div className="space-y-3">
        {ranked.map((model, index) => (
          <div
            key={model.name}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{MEDALS[index] || `#${index + 1}`}</span>
              <span className="font-medium text-slate-800">{model.name}</span>
            </div>
            <span className="font-semibold text-blue-600">{(model.f1_score * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ModelRankingPanel;
