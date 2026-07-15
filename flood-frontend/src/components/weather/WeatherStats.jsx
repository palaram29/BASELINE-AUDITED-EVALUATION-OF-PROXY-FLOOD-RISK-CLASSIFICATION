function WeatherStats({ weather }) {
  const totalCities = weather.length;

  const averageTemperature = (
    weather.reduce((sum, item) => sum + item.Temperature, 0) / totalCities
  ).toFixed(1);

  const averageRainfall = (
    weather.reduce((sum, item) => sum + item.Rainfall, 0) / totalCities
  ).toFixed(2);

  const averageWindSpeed = (
    weather.reduce((sum, item) => sum + item.WindSpeed, 0) / totalCities
  ).toFixed(1);

  const cards = [
    {
      title: "Total Cities",
      value: totalCities,
      unit: "",
    },
    {
      title: "Avg Temperature",
      value: averageTemperature,
      unit: "°C",
    },
    {
      title: "Avg Rainfall",
      value: averageRainfall,
      unit: "mm",
    },
    {
      title: "Avg Wind Speed",
      value: averageWindSpeed,
      unit: "km/h",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-xl shadow-md p-6"
        >
          <p className="text-gray-500">{card.title}</p>

          <h2 className="text-3xl font-bold mt-2">
            {card.value} {card.unit}
          </h2>
        </div>
      ))}
    </div>
  );
}

export default WeatherStats;