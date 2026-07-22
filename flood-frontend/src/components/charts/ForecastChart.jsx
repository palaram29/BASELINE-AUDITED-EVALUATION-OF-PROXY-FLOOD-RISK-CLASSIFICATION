import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

function ForecastChart({ data = [] }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 p-6 shadow-md ring-1 ring-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">24-hour forecast outlook</h3>
        <p className="text-sm text-slate-500">Rainfall and water level trend preview</p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="rainfall" stroke="#2563eb" strokeWidth={2} />
          <Line type="monotone" dataKey="riverLevel" stroke="#f59e0b" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ForecastChart;
