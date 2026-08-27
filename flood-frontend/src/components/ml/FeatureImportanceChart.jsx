import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import Card from "../common/Card";
import { useChartTheme } from "../../utils/chartTheme";

// Horizontal bar chart of feature importance for the current best
// model. Purely prop-driven off bestModel.feature_importance, so it
// re-renders automatically whenever the best model changes (new
// training run, new retrain) - no extra wiring needed.
const FEATURE_LABELS = {
  City_Encoded: "City",
  Rainfall_3Day: "Rainfall (3 Days)",
  Avg_Temperature: "Temperature",
  Avg_WindSpeed: "Wind Speed",
  Elevation: "Elevation",
};

function FeatureImportanceChart({ featureImportance = {}, modelName }) {
  const chart = useChartTheme();
  const data = Object.entries(featureImportance)
    .map(([key, value]) => ({ name: FEATURE_LABELS[key] || key, importance: value }))
    .sort((a, b) => a.importance - b.importance);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-heading">Feature Importance</h3>
        <p className="text-sm text-muted">
          {modelName ? `${modelName}'s` : "Best model's"} feature contributions to its predictions
        </p>
      </div>

      {data.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              stroke={chart.axisLine}
              tick={{ fill: chart.axis, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              stroke={chart.axisLine}
              tick={{ fill: chart.axis, fontSize: 12 }}
            />
            <Tooltip
              contentStyle={chart.tooltip.contentStyle}
              labelStyle={chart.tooltip.labelStyle}
              itemStyle={chart.tooltip.itemStyle}
              cursor={chart.tooltip.cursor}
              formatter={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <Bar dataKey="importance" fill={chart.brand} radius={[0, 6, 6, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-10 text-center text-sm text-faint">No feature importance data available.</p>
      )}
    </Card>
  );
}

export default FeatureImportanceChart;
