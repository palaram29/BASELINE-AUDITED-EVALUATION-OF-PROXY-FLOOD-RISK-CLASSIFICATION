import useMLOpsMonitoring from "../../hooks/useMLOpsMonitoring";
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";
import ProductionModelCard from "../../components/mlops/ProductionModelCard";
import FeatureDriftPanel from "../../components/mlops/FeatureDriftPanel";
import PredictionDistributionChart from "../../components/mlops/PredictionDistributionChart";
import DataQualityPanel from "../../components/mlops/DataQualityPanel";
import PerformancePanel from "../../components/mlops/PerformancePanel";
import ModelRegistryPanel from "../../components/mlops/ModelRegistryPanel";
import RetrainingAlertsPanel from "../../components/mlops/RetrainingAlertsPanel";
import TrainingHistoryTable from "../../components/mlops/TrainingHistoryTable";

function LoadingCard() {
  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-md">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// MLOps monitoring: production-model lifecycle, live feature/prediction
// drift, data quality, training history and promotion/rollback - the
// evidence layer behind this system's frozen-model retraining policy
// (docs/ML_METHODOLOGY_AND_LIMITATIONS.md §18). A separate top-level
// page from ML Dashboard (algorithm comparison, unchanged) - matches
// this app's one-concern-per-page routing convention.
function MLOps() {
  const {
    productionModel,
    modelVersions,
    trainingHistory,
    performance,
    drift,
    dataQuality,
    predictions,
    retrainingStatus,
    health,
    loading,
    error,
    lastUpdated,
    refetch,
  } = useMLOpsMonitoring();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">MLOps Monitoring</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Production model lifecycle, live feature/prediction drift and data quality. Retraining stays a
            deliberate, human-reviewed step - this page only ever surfaces evidence for that decision, never
            triggers it automatically. For algorithm comparison, see{" "}
            <a href="/ml-dashboard" className="text-blue-600 hover:text-blue-700">ML Dashboard</a>.
          </p>
          {lastUpdated ? (
            <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdated.toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <LoadingCard />
      ) : (
        <>
          <ProductionModelCard productionModel={productionModel} health={health} />

          <div className="grid gap-6 xl:grid-cols-2">
            <FeatureDriftPanel drift={drift} />
            <PredictionDistributionChart predictions={predictions} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DataQualityPanel dataQuality={dataQuality} />
            <PerformancePanel performance={performance} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ModelRegistryPanel modelVersions={modelVersions} onPromoted={refetch} />
            <RetrainingAlertsPanel retrainingStatus={retrainingStatus} />
          </div>

          <TrainingHistoryTable trainingHistory={trainingHistory} />
        </>
      )}
    </div>
  );
}

export default MLOps;
