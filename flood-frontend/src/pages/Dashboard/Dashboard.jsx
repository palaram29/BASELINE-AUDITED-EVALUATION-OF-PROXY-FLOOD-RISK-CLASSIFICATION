import { useState } from "react";
import useLiveDashboard from "../../hooks/useLiveDashboard";
import useReliability from "../../hooks/useReliability";
import SummarySection from "../../components/dashboard/SummarySection";
import WeatherTable from "../../components/tables/WeatherTable";
import RiverTable from "../../components/tables/RiverTable";
import RainfallChart from "../../components/charts/RainfallChart";
import PredictionTable from "../../components/tables/PredictionTable";
import RiskOverview from "../../components/dashboard/RiskOverview";
import FloodMap from "../../components/maps/FloodMap";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";
import Badge from "../../components/common/Badge";
import Toast from "../../components/common/Toast";
import ViewToggle from "../../components/common/ViewToggle";
import UserAlertBanner from "../../components/dashboard/UserAlertBanner";
import ReliabilityScoreCard from "../../components/reliability/ReliabilityScoreCard";
import { normalizeRisk } from "../../utils/riskLevels";

function Dashboard() {
  const { dashboard, loading, error, lastUpdated, retry } = useLiveDashboard();
  const { summary: reliabilitySummary } = useReliability();
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("live");
  // Recomputes the toast from `dashboard` during render (not in an effect)
  // whenever it changes, skipping the very first render so mount doesn't
  // flash a toast for already-known conditions. React's documented pattern
  // for adjusting state when a prop/value changes.
  const [announcedDashboard, setAnnouncedDashboard] = useState(null);
  if (dashboard !== announcedDashboard) {
    const isFirstRun = announcedDashboard === null;
    setAnnouncedDashboard(dashboard);

    if (!isFirstRun) {
      const criticalRiver = dashboard.river.find((item) => item.Status === "Alert");
      // Predicted_Risk's real values are Low/Medium/High/Extreme (the ML
      // model's training labels, not "Moderate"/"Very High") - normalizeRisk()
      // catches "Extreme" too, so the most severe predictions still raise
      // this alert instead of being silently ignored.
      const highRiskCity = dashboard.prediction.find((item) => {
        const risk = normalizeRisk(item.Predicted_Risk);
        return risk === "High" || risk === "Very High";
      });

      if (!criticalRiver && !highRiskCity) {
        setToast(null);
      } else {
        const message = criticalRiver && highRiskCity
          ? `${criticalRiver.River} is at a critical level and ${highRiskCity.City} is under high risk.`
          : criticalRiver
            ? `${criticalRiver.River} has reached a critical level.`
            : `${highRiskCity.City} has moved into high risk.`;

        setToast({ message, type: "danger" });
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-40 w-full rounded-3xl sm:h-32" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Backend errors still leave `dashboard` populated with simulated
          data (see useLiveDashboard), so the page stays usable behind
          this banner instead of being replaced by it. */}
      {error ? <ErrorMessage message={error} onRetry={retry} /> : null}

      <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Flood monitoring dashboard</h1>
              <Badge tone="green">Operational</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-blue-100 sm:text-base">
              Live river and weather conditions across Sri Lanka, automatically refreshed, plus the ML model's
              next-day flood-risk forecast built from that data.
            </p>
          </div>
          <Card className="border-0 bg-white/10 px-4 py-3 text-white backdrop-blur">
            <p className="text-sm text-blue-100">Last update</p>
            <p className="text-lg font-semibold">{lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Sri Lanka</p>
          </Card>
        </div>
      </div>

      <UserAlertBanner />

      <FloodMap />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">
            {view === "live" ? "Live observed conditions" : "ML flood-risk forecast"}
          </h2>
          <p className="text-sm text-slate-500">
            {view === "live"
              ? "Directly from the latest automatic weather/river collection — not model output."
              : "The frozen production model's forecast for the following day, scored on the live data above — a prediction, not an observed condition."}
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} tomorrowLabel="Tomorrow (forecast)" />
      </div>

      {view === "live" ? (
        <>
          <SummarySection dashboard={dashboard} />
          <RainfallChart weather={dashboard.weather} />
          <WeatherTable weather={dashboard.weather} />
          <RiverTable rivers={dashboard.river} />
        </>
      ) : (
        <>
          <RiskOverview prediction={dashboard.prediction} />
          <PredictionTable predictions={dashboard.prediction} />
        </>
      )}

      <div className="xl:w-1/2">
        <ReliabilityScoreCard summary={reliabilitySummary} />
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

export default Dashboard;