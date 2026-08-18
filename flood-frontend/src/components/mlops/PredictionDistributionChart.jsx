import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";

// Live prediction-risk distribution vs. the training-period reference
// distribution (docs/ML_METHODOLOGY_AND_LIMITATIONS.md §4) - not an
// assumption, a measured number from that document.
function PredictionDistributionChart({ predictions }) {
  const distribution = predictions?.distribution || [];

  const data = distribution.map((d) => ({
    risk: d.risk_level,
    Live: d.percentage,
    Reference: d.reference_percentage,
  }));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Prediction Distribution</h3>
      {data.length ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="risk" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => (v != null ? `${v.toFixed(2)}%` : "—")} />
              <Legend />
              <Bar dataKey="Live" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Reference" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {predictions.max_deviation_pct_points != null ? (
            <p className="mt-3 text-xs text-slate-500">
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
