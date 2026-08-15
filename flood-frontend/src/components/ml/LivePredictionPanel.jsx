import { useState } from "react";
import { FaBolt } from "react-icons/fa";
import Card from "../common/Card";
import Badge from "../common/Badge";
import ErrorMessage from "../common/ErrorMessage";
import { CITIES } from "../../constants/cities";
import { predictBestModel } from "../../services/mlService";
import { riskTone } from "../../utils/riskTone";

// "Live Flood Prediction" section: predicts using ONLY the current best
// model for a chosen city.
function LivePredictionPanel({ bestModelName, onPredicted }) {
  const [city, setCity] = useState(CITIES[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePredict = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await predictBestModel(city);
      setResult(data);
      onPredicted?.(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Prediction failed. Try another city.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <FaBolt size={16} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Live Flood Prediction</h3>
          <p className="text-sm text-slate-500">
            Predicts using only the current best model{bestModelName ? ` (${bestModelName})` : ""}.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={handlePredict}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Predicting..." : "Predict"}
        </button>
      </div>

      {error ? <div className="mt-4"><ErrorMessage message={error} /></div> : null}

      {result ? (
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Predicted Risk</p>
            <div className="mt-1"><Badge tone={riskTone(result.risk)}>{result.risk?.toUpperCase()}</Badge></div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Predicted For</p>
            <p className="mt-1 font-semibold text-slate-800">{result.predicted_for_date || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
            <p className="mt-1 font-semibold text-slate-800">
              {result.confidence != null ? `${(result.confidence * 100).toFixed(0)}%` : "n/a"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Model Used</p>
            <p className="mt-1 font-semibold text-slate-800">{result.model_used}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Prediction Time</p>
            <p className="mt-1 font-semibold text-slate-800">{result.prediction_time_ms.toFixed(0)} ms</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default LivePredictionPanel;
