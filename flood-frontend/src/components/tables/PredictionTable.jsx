import { normalizeRisk } from "../../utils/riskLevels";

// Predicted_Risk's real values are Low/Medium/High/Extreme (the ML model's
// training labels), not "Moderate" - a direct string comparison against
// "Moderate" left both Medium and Extreme predictions colored green.
const RISK_TEXT_CLASS = {
  "Very High": "text-red-600",
  High: "text-orange-600",
  Medium: "text-yellow-600",
  Low: "text-green-600",
};

function PredictionTable({ predictions }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        Latest Flood Predictions
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-4 py-3 text-left">City</th>
              <th className="px-4 py-3 text-left">3-Day Rainfall</th>
              <th className="px-4 py-3 text-left">Temperature</th>
              <th className="px-4 py-3 text-left">Wind Speed</th>
              <th className="px-4 py-3 text-left">Risk</th>
            </tr>
          </thead>

          <tbody>
            {predictions.map((prediction) => (
              <tr
                key={prediction.id}
                className="border-b hover:bg-slate-50"
              >
                <td className="px-4 py-3">{prediction.City}</td>
                <td className="px-4 py-3">
                  {prediction.Rainfall_3Day} mm
                </td>
                <td className="px-4 py-3">
                  {prediction.Avg_Temperature} °C
                </td>
                <td className="px-4 py-3">
                  {prediction.Avg_WindSpeed} km/h
                </td>
                <td
                  className={`px-4 py-3 font-semibold ${RISK_TEXT_CLASS[normalizeRisk(prediction.Predicted_Risk)]}`}
                >
                  {prediction.Predicted_Risk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PredictionTable;