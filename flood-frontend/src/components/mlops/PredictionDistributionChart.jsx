import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { useChartTheme } from "../../utils/chartTheme";

// Live prediction-risk distribution vs. the training-period reference
// distribution (docs/ML_METHODOLOGY_AND_LIMITATIONS.md §4) - not an
// assumption, a measured number from that document.
function PredictionDistributionChart({ predictions }) {
  const chart = useChartTheme();
  const distribution = predictions?.distribution || [];

  const data = distribution.map((d) => ({
    risk: d.risk_level,
    Live: d.percentage,
    Reference: d.reference_percentage,
  }));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-heading">Prediction Distribution</h3>
      {data.length ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="risk" stroke={chart.axisLine} tick={{ fill: chart.axis, fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}%`} stroke={chart.axisLine} tick={{ fill: chart.axis, fontSize: 12 }} />
              <Tooltip
                contentStyle={chart.tooltip.contentStyle}
                labelStyle={chart.tooltip.labelStyle}
                itemStyle={chart.tooltip.itemStyle}
                cursor={chart.tooltip.cursor}
                formatter={(v) => (v != null ? `${v.toFixed(2)}%` : "—")}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: chart.axis }} />
              <Bar dataKey="Live" fill={chart.brand} radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Reference" fill={chart.axis} radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
          {predictions.max_deviation_pct_points != null ? (
            <p className="mt-3 text-xs text-muted">
              Max deviation from training-period reference: {predictions.max_deviation_pct_points.toFixed(2)} points
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No predictions yet"
          description="Live predictions will appear here once the pipeline records some."
        />
      )}
    </Card>
  );
}

export default PredictionDistributionChart;
