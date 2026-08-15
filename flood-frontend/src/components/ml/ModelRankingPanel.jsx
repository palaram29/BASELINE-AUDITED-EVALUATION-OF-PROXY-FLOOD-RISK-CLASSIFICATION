import Card from "../common/Card";

const MEDALS = ["🥇", "🥈", "🥉"];

// Ranking panel, sorted by Macro-F1 every time `models` changes (i.e.
// automatically after each training run). Macro-F1, not weighted F1/
// accuracy, because this ranking must agree with the actual selection
// rule in ML/model_selector.py::select_best_model - ranking by weighted
// F1 previously put Random Forest in 1st place here while the Best
// Performing Model panel correctly showed LightGBM, a visible
// contradiction on the same dashboard.
function ModelRankingPanel({ models = [] }) {
  const ranked = [...models].sort((a, b) => (b.macro_f1 || 0) - (a.macro_f1 || 0));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Model Ranking (by Macro-F1)</h3>
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
            <span className="font-semibold text-blue-600">{(model.macro_f1 * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Ranked by raw Macro-F1 only. The model actually selected for prediction can differ from #1 here when
        High/Extreme-risk recall favors another model within a close Macro-F1 margin - see the Best Performing
        Model panel for the exact tie-break reasoning.
      </p>
    </Card>
  );
}

export default ModelRankingPanel;
