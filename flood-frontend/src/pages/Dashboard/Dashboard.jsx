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
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";
import Badge from "../../components/common/Badge";
import Toast from "../../components/common/Toast";
import ViewToggle from "../../components/common/ViewToggle";
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

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-6 text-white shadow-xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Flood monitoring dashboard
              </h1>
              <Badge tone="green" dot>Operational</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Live river and weather conditions across Sri Lanka, automatically refreshed, plus the
              ML model's next-day flood-risk forecast built from that data.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-slate-400">Last update</p>
            <p className="mt-0.5 text-lg font-semibold">
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              <span className="ml-1 text-sm font-normal text-slate-400">· Sri Lanka</span>
            </p>
          </div>
        </div>
      </div>

      <FloodMap />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            {view === "live" ? "Live observed conditions" : "ML flood-risk forecast"}
          </h2>
          <p className="text-sm text-muted">
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