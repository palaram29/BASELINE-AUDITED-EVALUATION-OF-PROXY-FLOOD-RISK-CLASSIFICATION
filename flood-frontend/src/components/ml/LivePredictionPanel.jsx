import { useState } from "react";
import { FaBolt } from "react-icons/fa";
import Card from "../common/Card";
import Badge from "../common/Badge";
import ErrorMessage from "../common/ErrorMessage";
import { CITIES } from "../../constants/cities";
import { predictBestModel } from "../../services/mlService";
import { riskTone } from "../../utils/riskTone";
import { RELIABILITY_TONE } from "../reliability/ReliabilityScoreCard";

// "ML Flood-Risk Prediction" section: scores the latest live weather
// data for a chosen city through the frozen production model. This is a
// model OUTPUT (a forecast), not an observed condition - see the River
// and Weather panels/map layers for observed data.
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
          <h3 className="text-lg font-semibold text-slate-800">ML Flood-Risk Prediction</h3>
          <p className="text-sm text-slate-500">
            A forecast from the frozen production model{bestModelName ? ` (${bestModelName})` : ""}, scored on the
            latest available weather data — not an observed condition. See the map's River and Weather layers for
            current observed conditions.
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
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Predicted Risk</p>
              <div className="mt-1"><Badge tone={riskTone(result.risk)}>{result.risk?.toUpperCase()}</Badge></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Predicted For</p>
              <p className="mt-1 font-semibold text-slate-800">{result.predicted_for_date || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Confidence (model)</p>
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
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Data Reliability</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-semibold text-slate-800">
                  {result.data_reliability_score != null ? `${Math.round(result.data_reliability_score * 100)}%` : "n/a"}
                </span>
                {result.data_reliability_level ? (
                  <Badge tone={RELIABILITY_TONE[result.data_reliability_level] || "slate"}>
                    {result.data_reliability_level}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          {result.degraded_data_warning ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Degraded data warning:</strong> the environmental data behind this prediction has LOW
              reliability. The forecast above is still shown as-is (not discarded) - treat it with reduced
              confidence and check the Data Reliability page for details.
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

export default LivePredictionPanel;
