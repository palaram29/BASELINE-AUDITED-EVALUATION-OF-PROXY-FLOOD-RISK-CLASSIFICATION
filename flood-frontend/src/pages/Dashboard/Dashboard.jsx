import { useEffect, useRef, useState } from "react";
import useLiveDashboard from "../../hooks/useLiveDashboard";
import SummarySection from "../../components/dashboard/SummarySection";
import WeatherTable from "../../components/tables/WeatherTable";
import RiverTable from "../../components/tables/RiverTable";
import RainfallChart from "../../components/charts/RainfallChart";
import PredictionTable from "../../components/tables/PredictionTable";
import RiskOverview from "../../components/dashboard/RiskOverview";
import FloodMap from "../../components/maps/FloodMap";
import ForecastChart from "../../components/charts/ForecastChart";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import Toast from "../../components/common/Toast";
import { forecastData } from "../../utils/forecastData";

function Dashboard() {
  const { dashboard, loading, error, lastUpdated } = useLiveDashboard();
  const [toast, setToast] = useState(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }

    const criticalRiver = dashboard.river.find((item) => item.Status === "Alert");
    const highRiskCity = dashboard.prediction.find((item) => item.Predicted_Risk === "High");

    if (!criticalRiver && !highRiskCity) {
      setToast(null);
      return;
    }

    const message = criticalRiver && highRiskCity
      ? `${criticalRiver.River} is at a critical level and ${highRiskCity.City} is under high risk.`
      : criticalRiver
        ? `${criticalRiver.River} has reached a critical level.`
        : `${highRiskCity.City} has moved into high risk.`;

    setToast({ message, type: "danger" });
  }, [dashboard]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-lg font-medium text-slate-600">Loading dashboard insights...</p>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Flood monitoring dashboard</h1>
              <Badge tone="green">Operational</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-blue-100 sm:text-base">Real-time flood intelligence for critical river, weather, and prediction zones across Sri Lanka.</p>
          </div>
          <Card className="border-0 bg-white/10 px-4 py-3 text-white backdrop-blur">
            <p className="text-sm text-blue-100">Last update</p>
            <p className="text-lg font-semibold">{lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Sri Lanka</p>
          </Card>
        </div>
      </div>

      <RiskOverview prediction={dashboard.prediction} />
      <SummarySection dashboard={dashboard} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <FloodMap />
        <ForecastChart data={forecastData} />
      </div>
      <RainfallChart weather={dashboard.weather} />
      <WeatherTable weather={dashboard.weather} />
      <RiverTable rivers={dashboard.river} />
      <PredictionTable predictions={dashboard.prediction} />
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

export default Dashboard;