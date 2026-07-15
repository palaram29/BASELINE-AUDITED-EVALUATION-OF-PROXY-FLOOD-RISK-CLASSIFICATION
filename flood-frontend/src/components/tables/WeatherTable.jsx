function WeatherTable({ weather }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        Latest Weather Data
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-4 py-3 text-left">City</th>
              <th className="px-4 py-3 text-left">Rainfall (mm)</th>
              <th className="px-4 py-3 text-left">Temperature (°C)</th>
              <th className="px-4 py-3 text-left">Wind Speed (km/h)</th>
            </tr>
          </thead>

          <tbody>
            {weather.map((item) => (
              <tr
                key={item.id}
                className="border-b hover:bg-slate-50"
              >
                <td className="px-4 py-3">{item.City}</td>
                <td className="px-4 py-3">{item.Rainfall}</td>
                <td className="px-4 py-3">{item.Temperature}</td>
                <td className="px-4 py-3">{item.WindSpeed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WeatherTable;