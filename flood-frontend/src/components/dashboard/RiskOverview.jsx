import Badge from "../common/Badge";

function RiskOverview({ prediction = [] }) {
  const highRiskCount = prediction.filter((item) => item.Predicted_Risk === "High").length;
  const moderateCount = prediction.filter((item) => item.Predicted_Risk === "Moderate").length;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-6 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-200">Risk outlook</p>
          <h2 className="mt-2 text-2xl font-semibold">Regional flood alert status</h2>
        </div>
        <Badge tone="red">Live monitoring</Badge>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-blue-100">High risk zones</p>
          <p className="mt-2 text-3xl font-semibold">{highRiskCount}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-blue-100">Moderate watch</p>
          <p className="mt-2 text-3xl font-semibold">{moderateCount}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <p className="text-sm text-blue-100">Preparedness</p>
          <p className="mt-2 text-3xl font-semibold">24/7</p>
        </div>
      </div>
    </div>
  );
}

export default RiskOverview;
