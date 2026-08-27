import Badge from "../common/Badge";
import { normalizeRisk } from "../../utils/riskLevels";

// "Today" counterpart to components/dashboard/RiskOverview.jsx (which
// summarises the t+1 forecast). Same tallies, but for the deterministic
// same-day Hazard x Vulnerability index.
function LiveRiskOverview({ liveRisk = [] }) {
  const highRiskCount = liveRisk.filter((item) => {
    const risk = normalizeRisk(item.Risk_Level);
    return risk === "High" || risk === "Very High";
  }).length;
  const moderateCount = liveRisk.filter(
    (item) => normalizeRisk(item.Risk_Level) === "Medium"
  ).length;
  const cityCount = liveRisk.length;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-900 p-6 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Current conditions</p>
          <h2 className="mt-2 text-2xl font-semibold">Today's flood-risk index (live)</h2>
        </div>
        <Badge tone="green">Rule-based</Badge>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-emerald-100">High risk now</p>
          <p className="mt-2 text-3xl font-semibold">{highRiskCount}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-emerald-100">Moderate watch</p>
          <p className="mt-2 text-3xl font-semibold">{moderateCount}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-emerald-100">Cities scored</p>
          <p className="mt-2 text-3xl font-semibold">{cityCount}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-emerald-100/80">
        Computed directly from current rainfall and each city's fixed flood exposure
        (elevation + coastal). Not a machine-learning prediction — see the Tomorrow view
        for the ML forecast.
      </p>
    </div>
  );
}

export default LiveRiskOverview;
