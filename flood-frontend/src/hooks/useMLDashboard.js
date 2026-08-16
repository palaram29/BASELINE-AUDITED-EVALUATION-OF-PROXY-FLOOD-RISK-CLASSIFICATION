import { useCallback, useEffect, useState } from "react";
import { getModels, getBestModel, getMLPredictionHistory } from "../services/mlService";

// Data-fetching hook for the ML Dashboard page. Polls the backend every
// 20s to reflect any change in prediction history; the production model
// itself is frozen (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md) and does
// not change between polls.
function useMLDashboard() {
  const [models, setModels] = useState([]);
  const [bestModel, setBestModel] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
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
        "No frozen production model found yet. Run `python ML/train_models.py` offline to train and freeze one."
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

  return {
    models,
    bestModel,
    history,
    loading,
    error,
    lastUpdated,
    refetch: fetchAll,
  };
}

export default useMLDashboard;
