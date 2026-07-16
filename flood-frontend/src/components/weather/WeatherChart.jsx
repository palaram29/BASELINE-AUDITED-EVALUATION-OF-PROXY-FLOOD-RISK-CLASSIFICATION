function WeatherChart({ weather }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        Rainfall Chart
      </h2>

      <p>Total Weather Records: {weather.length}</p>
    </div>
  );
}

export default WeatherChart;