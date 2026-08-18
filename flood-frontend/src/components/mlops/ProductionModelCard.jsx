import Card from "../common/Card";
import MLOpsHealthBadge from "./MLOpsHealthBadge";

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/70 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function pct(value) {
  return value != null ? `${(value * 100).toFixed(1)}%` : "—";
}

// Large highlighted "Production Model" panel - same visual language as
// ml/BestModelPanel.jsx, but sourced from the MLOps registry (or the
// pre-existing production_model.json fallback - see `source` below) and
// paired with the aggregate health rollup rather than model-comparison
// metrics.
function ProductionModelCard({ productionModel, health }) {
  if (!productionModel) return null;

  const trainedAt = productionModel.trained_at ? new Date(productionModel.trained_at) : null;

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Production Model</p>
            {health ? <MLOpsHealthBadge status={health.status} /> : null}
          </div>
          <h2 className="mt-1 text-2xl font-bold text-slate-800">
            {productionModel.algorithm} {productionModel.version ? `v${productionModel.version}` : ""}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {trainedAt ? `Trained ${trainedAt.toLocaleString()}` : "Training date unknown"}
          </p>
          <p className="mt-2 max-w-xl text-xs text-slate-500">{productionModel.source}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Macro-F1" value={pct(productionModel.macro_f1)} />
          <Stat label="Accuracy" value={pct(productionModel.accuracy)} />
          <Stat label="High Recall" value={pct(productionModel.high_risk_recall)} />
          <Stat label="Extreme Recall" value={pct(productionModel.extreme_risk_recall)} />
        </div>
      </div>
    </Card>
  );
}

export default ProductionModelCard;
