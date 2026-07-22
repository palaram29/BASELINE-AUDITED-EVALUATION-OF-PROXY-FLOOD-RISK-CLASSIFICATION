import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function WeatherChart({ weather }) {
  const data = weather.map((item) => ({
    city: item.City,
    rainfall: Number(item.Rainfall),
  }));

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        Rainfall by City
      </h2>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="city"
            angle={-35}
            textAnchor="end"
            height={80}
          />

          <YAxis />

          <Tooltip />

          <Bar
            dataKey="rainfall"
            fill="#2563eb"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WeatherChart;