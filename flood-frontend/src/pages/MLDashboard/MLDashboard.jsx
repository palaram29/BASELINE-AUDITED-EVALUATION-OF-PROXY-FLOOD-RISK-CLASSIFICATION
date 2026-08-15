import useMLDashboard from "../../hooks/useMLDashboard";
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";
import ModelOverviewCard from "../../components/ml/ModelOverviewCard";
import ModelComparisonTable from "../../components/ml/ModelComparisonTable";
import BestModelPanel from "../../components/ml/BestModelPanel";
import LivePredictionPanel from "../../components/ml/LivePredictionPanel";
import FeatureImportanceChart from "../../components/ml/FeatureImportanceChart";
import ConfusionMatrixView from "../../components/ml/ConfusionMatrixView";
import ModelRankingPanel from "../../components/ml/ModelRankingPanel";
import TrainingHistoryPanel from "../../components/ml/TrainingHistoryPanel";
import PredictionHistoryTable from "../../components/ml/PredictionHistoryTable";

function CardSkeletonRow() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 rounded-xl bg-white p-6 shadow-md">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

function MLDashboard() {
  const { models, bestModel, history, loading, training, error, lastUpdated, retrain } = useMLDashboard();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">ML Model Dashboard</h1>
          <p className="mt-2 text-slate-500">
            Compare Random Forest, XGBoost and LightGBM, and predict flood risk with the current best model.
          </p>
          {lastUpdated ? (
            <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdated.toLocaleTimeString()}</p>
          ) : null}
        </div>
        <button
          onClick={retrain}
          disabled={training}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {training ? "Retraining..." : "Retrain Models"}
        </button>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <CardSkeletonRow />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {models.map((model) => (
            <ModelOverviewCard key={model.name} model={model} isBest={model.name === bestModel?.name} />
          ))}
        </div>
      )}

      {!loading && models.length ? <ModelComparisonTable models={models} bestModelName={bestModel?.name} /> : null}
      {!loading && bestModel ? <BestModelPanel bestModel={bestModel} /> : null}

      <LivePredictionPanel bestModelName={bestModel?.name} />

      {!loading && bestModel ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <FeatureImportanceChart featureImportance={bestModel.feature_importance} modelName={bestModel.name} />
          <ConfusionMatrixView matrix={bestModel.confusion_matrix} labels={bestModel.labels} modelName={bestModel.name} />
        </div>
      ) : null}

      {!loading && models.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ModelRankingPanel models={models} />
          <TrainingHistoryPanel bestModel={bestModel} />
        </div>
      ) : null}

      <PredictionHistoryTable history={history} />
    </div>
  );
}

export default MLDashboard;
