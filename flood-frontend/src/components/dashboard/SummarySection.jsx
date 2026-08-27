import { FiMapPin, FiCloudRain, FiActivity, FiAlertTriangle } from "react-icons/fi";
import SummaryCard from "../cards/SummaryCard";
import { normalizeRisk } from "../../utils/riskLevels";

function SummarySection({ dashboard }) {
  const totalCities = dashboard.weather.length;

  // Genuinely no weather rows yet is a real, reachable state now (no
  // longer masked by demo-data fallback) - guard the division so it
  // reads "0.00 mm" instead of "NaN mm".
  const averageRainfall = totalCities
    ? dashboard.weather.reduce((sum, item) => sum + item.Rainfall, 0) / totalCities
    : 0;

  const riversAtRisk = dashboard.river.filter((item) => item.Status !== "Normal").length;

  // Predicted_Risk's real values are Low/Medium/High/Extreme (the ML
  // model's training labels) - normalizeRisk() catches "Extreme" too, so
  // the most severe predictions aren't left out of this count.
  const highRiskPredictions = dashboard.prediction.filter((item) => {
    const risk = normalizeRisk(item.Predicted_Risk);
    return risk === "High" || risk === "Very High";
  }).length;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Cities monitored" value={totalCities} icon={FiMapPin} tone="blue" />
      <SummaryCard
        title="Avg rainfall"
        value={`${averageRainfall.toFixed(2)} mm`}
        icon={FiCloudRain}
        tone="blue"
      />
      <SummaryCard
        title="Rivers at risk"
        value={riversAtRisk}
        icon={FiActivity}
        tone={riversAtRisk > 0 ? "orange" : "green"}
      />
      <SummaryCard
        title="High-risk predictions"
        value={highRiskPredictions}
        icon={FiAlertTriangle}
        tone={highRiskPredictions > 0 ? "red" : "green"}
      />
    </div>
  );
}

export default SummarySection;
