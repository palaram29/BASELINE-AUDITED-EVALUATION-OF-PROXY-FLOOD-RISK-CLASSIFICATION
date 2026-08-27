import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { useChartTheme } from "../../utils/chartTheme";

function WeatherChart({ weather }) {
  const chart = useChartTheme();
  const data = (weather || []).map((item) => ({
    city: item.City,
    rainfall: Number(item.Rainfall),
  }));

  return (
    <Card title="Rainfall by city" subtitle="Observed 24-hour rainfall per station">
      {data.length ? (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis
              dataKey="city"
              angle={-35}
              textAnchor="end"
              height={80}
              stroke={chart.axisLine}
              tick={{ fill: chart.axis, fontSize: 12 }}
            />
            <YAxis stroke={chart.axisLine} tick={{ fill: chart.axis, fontSize: 12 }} />
            <Tooltip
              contentStyle={chart.tooltip.contentStyle}
              labelStyle={chart.tooltip.labelStyle}
              itemStyle={chart.tooltip.itemStyle}
              cursor={chart.tooltip.cursor}
              formatter={(v) => [`${v} mm`, "Rainfall"]}
            />
            <Bar dataKey="rainfall" fill={chart.brand} radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No weather data" description="Readings will appear here after the next collection." />
      )}
    </Card>
  );
}

export default WeatherChart;
