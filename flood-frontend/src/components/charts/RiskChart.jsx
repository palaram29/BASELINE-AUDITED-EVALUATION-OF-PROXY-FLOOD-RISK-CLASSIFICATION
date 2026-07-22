import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

function RiskChart({ prediction = [] }) {
  const data = prediction.map((item) => ({
    name: item.City,
    risk: item.Predicted_Risk === "High" ? 3 : item.Predicted_Risk === "Moderate" ? 2 : 1,
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
