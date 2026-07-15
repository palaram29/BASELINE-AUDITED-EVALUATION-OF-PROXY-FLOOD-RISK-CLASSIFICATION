import WeatherStats from "../../components/weather/WeatherStats";
import WeatherSearch from "../../components/weather/WeatherSearch";
import WeatherChart from "../../components/weather/WeatherChart";
import WeatherTable from "../../components/weather/WeatherTable";

function Weather() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Weather Monitoring</h1>
        <p className="text-slate-500">
          Latest weather conditions across Sri Lanka
        </p>
      </div>

      <WeatherStats />
      <WeatherSearch />
      <WeatherChart />
      <WeatherTable />
    </div>
  );
}

export default Weather;