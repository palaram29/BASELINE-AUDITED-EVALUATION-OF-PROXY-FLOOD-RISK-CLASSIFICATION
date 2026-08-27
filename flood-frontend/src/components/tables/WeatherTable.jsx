import Card from "../common/Card";
import EmptyState from "../common/EmptyState";

function WeatherTable({ weather = [] }) {
  return (
    <Card title="Latest weather data" subtitle="Most recent observation per monitored city">
      {weather.length ? (
        <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>City</th>
                <th>Rainfall (mm)</th>
                <th>Temperature (°C)</th>
                <th>Wind speed (km/h)</th>
              </tr>
            </thead>
            <tbody>
              {weather.map((item, index) => (
                <tr key={item.id ?? `${item.City}-${index}`}>
                  <td>{item.City}</td>
                  <td>{item.Rainfall}</td>
                  <td>{item.Temperature}</td>
                  <td>{item.WindSpeed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No weather data" description="Readings appear here after the next automatic collection." />
      )}
    </Card>
  );
}

export default WeatherTable;
