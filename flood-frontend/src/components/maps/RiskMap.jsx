import { useMemo } from "react";
import { sriLankaOutline } from "./sriLankaOutline";

const regionMarkers = [
  { name: "Western", x: 175, y: 165, risk: "High" },
  { name: "Central", x: 255, y: 145, risk: "Moderate" },
  { name: "Southern", x: 205, y: 235, risk: "Moderate" },
  { name: "Northern", x: 350, y: 145, risk: "Low" },
  { name: "Eastern", x: 360, y: 225, risk: "Low" },
];

function RiskMap({ river = [], prediction = [] }) {
  const regions = useMemo(() => {
    const highRiskCities = prediction.filter((item) => item.Predicted_Risk === "High").map((item) => item.City?.toLowerCase());
    const alertRivers = river.filter((item) => item.Status === "Alert").map((item) => item.River?.toLowerCase());

    return regionMarkers.map((region) => {
      const hasHighRisk = highRiskCities.some((city) => ["colombo", "gampaha", "kalutara", "kandy", "matale", "galle", "matara"].includes(city));
      const hasAlertRiver = alertRivers.some((riverName) => ["kelani", "kalu", "mahaweli"].includes(riverName));
      const risk = region.name === "Western" && hasHighRisk ? "High" : region.name === "Western" && hasAlertRiver ? "Moderate" : region.name === "Central" ? "Moderate" : "Low";

      return {
        ...region,
        risk,
        color: risk === "High" ? "#ef4444" : risk === "Moderate" ? "#f59e0b" : "#22c55e",
        detail: risk === "High" ? "Active high-risk zone" : risk === "Moderate" ? "Watch conditions" : "Stable conditions",
      };
    });
  }, [river, prediction]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Sri Lanka flood risk map</h3>
          <p className="text-sm text-slate-500">Live regional view of monitored flood zones</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />High</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Moderate</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Low</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
        <svg viewBox={sriLankaOutline.viewBox} className="h-72 w-full rounded-2xl">
          <rect x="0" y="0" width="520" height="520" rx="16" fill="#f8fbff" />
          <path d={sriLankaOutline.path} fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
          <path d="M120 125 C150 110, 190 110, 220 130" stroke="#60a5fa" strokeWidth="2" fill="none" strokeDasharray="3 3" />
          <path d="M220 150 C260 135, 315 140, 345 175" stroke="#60a5fa" strokeWidth="2" fill="none" strokeDasharray="3 3" />
          <path d="M165 255 C195 242, 215 240, 245 255" stroke="#60a5fa" strokeWidth="2" fill="none" strokeDasharray="3 3" />

          {regions.map((region) => (
            <g key={region.name}>
              <circle cx={region.x} cy={region.y} r="18" fill={region.color} opacity="0.95" />
              <circle cx={region.x} cy={region.y} r="28" fill="none" stroke={region.color} strokeWidth="2" strokeDasharray="4 3" />
              <text x={region.x + 24} y={region.y + 4} fontSize="12" fill="#0f172a" fontWeight="600">{region.name}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {regions.map((region) => (
          <div key={region.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: region.color }} />
              <p className="font-medium text-slate-700">{region.name}</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">{region.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RiskMap;
