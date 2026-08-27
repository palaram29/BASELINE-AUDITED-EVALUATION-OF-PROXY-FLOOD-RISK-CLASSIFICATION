const TONES = {
  blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200",
  yellow: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200",
};

function WeatherForecastCard({ title, value, detail, tone = "blue" }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONES[tone] || TONES.blue}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
    </div>
  );
}

export default WeatherForecastCard;
