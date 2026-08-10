import { useCallback, useEffect, useState } from "react";
import { getModels, getBestModel, trainModels, getMLPredictionHistory } from "../services/mlService";

// Data-fetching hook for the ML Dashboard page. Polls the backend every
// 20s so the dashboard picks up a newly-selected best model automatically
// after a retrain, without requiring a page reload (same pattern as
// useLiveDashboard's real-polling fix).
function useMLDashboard() {
  const [models, setModels] = useState([]);
  const [bestModel, setBestModel] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [modelsData, bestModelData, historyData] = await Promise.all([
        getModels(),
        getBestModel(),
        getMLPredictionHistory(),
      ]);
      setModels(modelsData);
      setBestModel(bestModelData);
      setHistory(historyData);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        "No trained models found yet. Click \"Retrain Models\" to get started."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const retrain = useCallback(async () => {
    setTraining(true);
    setError("");
    try {
      await trainModels();
      await fetchAll();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Training failed. Check the backend logs for details.");
    } finally {
      setTraining(false);
    }
  }, [fetchAll]);

  return {
    models,
    bestModel,
    history,
    loading,
    training,
    error,
    lastUpdated,
    retrain,
    refetch: fetchAll,
  };
}

export default useMLDashboard;
