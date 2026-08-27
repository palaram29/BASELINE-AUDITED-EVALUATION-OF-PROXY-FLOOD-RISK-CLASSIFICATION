import useMLDashboard from "../../hooks/useMLDashboard";
import PageHeader from "../../components/common/PageHeader";
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
        <div key={i} className="card space-y-4 p-6">
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
  const { models, bestModel, history, loading, error, lastUpdated } = useMLDashboard();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Machine Learning"
        title="ML model dashboard"
        description="Random Forest, XGBoost and LightGBM were compared on the historical dataset; the best performer is frozen as the production model and used for all live ML flood-risk predictions below."
        meta={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : undefined}
        actions={
          bestModel?.production_status === "frozen" ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-body">
              🔒 Frozen production model
              {bestModel.production_version ? ` · v${bestModel.production_version}` : ""}
            </span>
          ) : null
        }
      />

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
