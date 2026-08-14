import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { normalizeRisk } from "../../utils/riskLevels";

// Real Predicted_Risk values are Low/Medium/High/Extreme (the ML model's
// training labels - see ML/data/train_dataset.csv), not "Moderate"; a
// direct string comparison against "Moderate" left Medium and Extreme both
// falling through to the same bar height as Low. normalizeRisk() maps every
// known synonym (including "Extreme") to one of the 4 real tiers first.
const RISK_RANK = { Low: 1, Medium: 2, High: 3, "Very High": 4 };

function RiskChart({ prediction = [] }) {
  const data = prediction.map((item) => ({
    name: item.City,
    risk: RISK_RANK[normalizeRisk(item.Predicted_Risk)],
  }));

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Risk intensity</h3>
          <p className="text-sm text-slate-500">Comparing predicted severity by city</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 4]} />
          <Tooltip />
          <Bar dataKey="risk" fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RiskChart;
