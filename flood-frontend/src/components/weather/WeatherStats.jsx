import {
  FaCity,
  FaCloudRain,
  FaTemperatureHigh,
  FaWind,
} from "react-icons/fa";

function WeatherStats({ weather }) {
  if (!weather.length) return null;

  const totalCities = weather.length;

  const avgRainfall = (
    weather.reduce((sum, item) => sum + Number(item.Rainfall), 0) /
    totalCities
  ).toFixed(2);

  const avgTemperature = (
    weather.reduce((sum, item) => sum + Number(item.Temperature), 0) /
    totalCities
  ).toFixed(1);

  const avgWind = (
    weather.reduce((sum, item) => sum + Number(item.WindSpeed), 0) /
    totalCities
  ).toFixed(1);

  const cards = [
    {
      title: "Cities",
      value: totalCities,
      icon: <FaCity className="text-blue-600 text-3xl" />,
    },
    {
      title: "Avg Rainfall",
      value: `${avgRainfall} mm`,
      icon: <FaCloudRain className="text-cyan-600 text-3xl" />,
    },
    {
      title: "Avg Temperature",
      value: `${avgTemperature} °C`,
      icon: <FaTemperatureHigh className="text-red-500 text-3xl" />,
    },
    {
      title: "Avg Wind Speed",
      value: `${avgWind} km/h`,
      icon: <FaWind className="text-green-600 text-3xl" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500">{card.title}</p>

              <h2 className="text-3xl font-bold mt-2">
                {card.value}
              </h2>
            </div>

            {card.icon}
          </div>
        </div>
      ))}
    </div>
  );
}

export default WeatherStats;