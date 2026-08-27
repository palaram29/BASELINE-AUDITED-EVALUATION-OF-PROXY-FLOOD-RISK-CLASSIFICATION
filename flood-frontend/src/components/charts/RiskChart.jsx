import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { normalizeRisk } from "../../utils/riskLevels";
import Card from "../common/Card";
import { useChartTheme } from "../../utils/chartTheme";

// Real Predicted_Risk values are Low/Medium/High/Extreme (the ML model's
// training labels - see ML/data/train_dataset.csv), not "Moderate"; a
// direct string comparison against "Moderate" left Medium and Extreme both
// falling through to the same bar height as Low. normalizeRisk() maps every
// known synonym (including "Extreme") to one of the 4 real tiers first.
const RISK_RANK = { Low: 1, Medium: 2, High: 3, "Very High": 4 };
const RISK_COLOR = {
  1: "#10b981",
  2: "#f59e0b",
  3: "#f97316",
  4: "#ef4444",
};

function RiskChart({ prediction = [] }) {
  const chart = useChartTheme();
  const data = prediction.map((item) => ({
    name: item.City,
    risk: RISK_RANK[normalizeRisk(item.Predicted_Risk)],
  }));

  return (
    <Card title="Risk intensity" subtitle="Predicted severity by city (Low → Very High)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis dataKey="name" stroke={chart.axisLine} tick={{ fill: chart.axis, fontSize: 12 }} />
          <YAxis
            domain={[0, 4]}
            ticks={[1, 2, 3, 4]}
            tickFormatter={(v) => ["", "Low", "Medium", "High", "Very High"][v] || ""}
            stroke={chart.axisLine}
            tick={{ fill: chart.axis, fontSize: 12 }}
            width={78}
          />
          <Tooltip
            contentStyle={chart.tooltip.contentStyle}
            labelStyle={chart.tooltip.labelStyle}
            itemStyle={chart.tooltip.itemStyle}
            cursor={chart.tooltip.cursor}
            formatter={(v) => [["", "Low", "Medium", "High", "Very High"][v] || "—", "Risk"]}
          />
          <Bar dataKey="risk" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((entry, index) => (
              <Cell key={index} fill={RISK_COLOR[entry.risk] || chart.brand} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default RiskChart;
