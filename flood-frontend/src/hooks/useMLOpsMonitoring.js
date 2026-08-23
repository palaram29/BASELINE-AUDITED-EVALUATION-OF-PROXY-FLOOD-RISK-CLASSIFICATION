import { useCallback, useEffect, useState } from "react";
import {
  getProductionModel,
  getModelVersions,
  getTrainingHistory,
  getPerformance,
  getDrift,
  getDataQuality,
  getPredictionDistribution,
  getRetrainingStatus,
  getHealth,
} from "../services/mlopsService";

// Data-fetching hook for the MLOps Monitoring page. Polls every 30s
// (matches usePipelineStatus.js's cadence - this is operational/status
// data, not results data like the ML Dashboard's 20s poll).
//
// Uses Promise.allSettled rather than Promise.all: on a fresh install
// with no production model registered yet, /mlops/model 404s but the
// other endpoints (drift/data-quality/etc.) can still return real,
// useful data - one missing piece shouldn't blank the whole page.
function useMLOpsMonitoring() {
  const [productionModel, setProductionModel] = useState(null);
  const [modelVersions, setModelVersions] = useState([]);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [drift, setDrift] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [retrainingStatus, setRetrainingStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    const [
      productionModelResult,
      modelVersionsResult,
      trainingHistoryResult,
      performanceResult,
      driftResult,
      dataQualityResult,
      predictionsResult,
      retrainingStatusResult,
      healthResult,
    ] = await Promise.allSettled([
      getProductionModel(),
      getModelVersions(),
      getTrainingHistory(),
      getPerformance(),
      getDrift(),
      getDataQuality(),
      getPredictionDistribution(),
      getRetrainingStatus(),
      getHealth(),
    ]);

    if (productionModelResult.status === "fulfilled") setProductionModel(productionModelResult.value);
    if (modelVersionsResult.status === "fulfilled") setModelVersions(modelVersionsResult.value);
    if (trainingHistoryResult.status === "fulfilled") setTrainingHistory(trainingHistoryResult.value);
    if (performanceResult.status === "fulfilled") setPerformance(performanceResult.value);
    if (driftResult.status === "fulfilled") setDrift(driftResult.value);
    if (dataQualityResult.status === "fulfilled") setDataQuality(dataQualityResult.value);
    if (predictionsResult.status === "fulfilled") setPredictions(predictionsResult.value);
    if (retrainingStatusResult.status === "fulfilled") setRetrainingStatus(retrainingStatusResult.value);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);

    if (productionModelResult.status === "rejected") {
      console.error(productionModelResult.reason);
      setError(
        productionModelResult.reason?.response?.data?.detail ||
        "No production model found yet. Run `python ML/train_models.py`, then `python ML/register_run.py`, to get started."
      );
    } else {
      setError("");
    }

    setLoading(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // fetchAll's setState calls all happen after an `await`, so this is
    // the standard fetch-on-mount pattern, not a synchronous render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
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
    refetch: fetchAll,
  };
}

export default useMLOpsMonitoring;
