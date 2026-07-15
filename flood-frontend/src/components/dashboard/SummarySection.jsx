import SummaryCard from "../cards/SummaryCard";

function SummarySection({ dashboard }) {

  const totalCities = dashboard.weather.length;

  const averageRainfall =
    dashboard.weather.reduce(
      (sum, item) => sum + item.Rainfall,
      0
    ) / totalCities;

  const riversAtRisk =
    dashboard.river.filter(
      item => item.Status !== "Normal"
    ).length;

  const highRiskPredictions =
    dashboard.prediction.filter(
      item => item.Predicted_Risk === "High"
    ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

      <SummaryCard
        title="Cities"
        value={totalCities}
      />

      <SummaryCard
        title="Avg Rainfall"
        value={`${averageRainfall.toFixed(2)} mm`}
      />

      <SummaryCard
        title="Rivers At Risk"
        value={riversAtRisk}
      />

      <SummaryCard
        title="High Risk Predictions"
        value={highRiskPredictions}
      />

    </div>
  );
}

export default SummarySection;