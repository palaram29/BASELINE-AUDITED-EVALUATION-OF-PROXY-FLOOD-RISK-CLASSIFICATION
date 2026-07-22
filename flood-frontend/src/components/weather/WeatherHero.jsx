import { FiCloudRain, FiThermometer, FiWind, FiSun } from "react-icons/fi";

function WeatherHero({ weather = [] }) {
  const total = weather.length || 0;
  const rainfall = weather.reduce((sum, item) => sum + Number(item.Rainfall || 0), 0);
  const temp = weather.reduce((sum, item) => sum + Number(item.Temperature || 0), 0);
  const wind = weather.reduce((sum, item) => sum + Number(item.WindSpeed || 0), 0);

  const avgRainfall = total ? (rainfall / total).toFixed(1) : "0.0";
  const avgTemp = total ? (temp / total).toFixed(1) : "0.0";
  const avgWind = total ? (wind / total).toFixed(1) : "0.0";

  const stats = [
    { label: "Stations", value: total, icon: FiSun },
    { label: "Avg Rainfall", value: `${avgRainfall} mm`, icon: FiCloudRain },
    { label: "Avg Temp", value: `${avgTemp}°C`, icon: FiThermometer },
    { label: "Avg Wind", value: `${avgWind} km/h`, icon: FiWind },
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-6 text-white shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Weather operations</p>
          <h2 className="mt-2 text-3xl font-semibold">Weather monitoring center</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">Real-time atmospheric conditions across monitored districts and stations in Sri Lanka.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
          <p className="text-sm text-slate-300">Live update</p>
          <p className="text-lg font-semibold">Every 15 min</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeatherHero;
