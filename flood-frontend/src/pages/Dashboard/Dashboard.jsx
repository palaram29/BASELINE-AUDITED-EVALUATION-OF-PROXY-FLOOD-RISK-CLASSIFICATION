import SummarySection from "../../components/dashboard/SummarySection";
import ChartSection from "../../components/dashboard/ChartSection";
import WeatherSection from "../../components/dashboard/WeatherSection";
import RiverSection from "../../components/dashboard/RiverSection";
import PredictionSection from "../../components/dashboard/PredictionSection";

function Dashboard() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Dashboard
        </h1>

        <p className="text-slate-500 mt-1">
          Real-time overview of the Flood Prediction System
        </p>
      </div>

      <SummarySection />

      <ChartSection />

      <WeatherSection />

      <RiverSection />

      <PredictionSection />

    </div>
  );
}

export default Dashboard;