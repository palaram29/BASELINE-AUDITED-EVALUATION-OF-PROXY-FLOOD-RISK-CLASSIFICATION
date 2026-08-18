import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";

const STATUS_TONE = { NORMAL: "green", WARNING: "yellow", CRITICAL: "red", UNKNOWN: "slate" };

// Per-feature PSI drift vs. the training baseline. Only the features
// that genuinely vary day to day are ever shown here (Rainfall_3Day/
// Avg_Temperature/Avg_WindSpeed) - the backend excludes Elevation/
// Coastal_Flag, which are static per-city constants and would always
// read ~0 drift by construction (see ML/utils.py DRIFT_MONITORED_FEATURES).
function FeatureDriftPanel({ drift }) {
  const features = drift?.features || [];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Feature Drift (PSI)</h3>
        {drift?.overall_status ? (
          <Badge tone={STATUS_TONE[drift.overall_status] || "slate"}>{drift.overall_status}</Badge>
        ) : null}
      </div>

      {features.length ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={features} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, "auto"]} />
              <YAxis type="category" dataKey="feature_name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => (v != null ? v.toFixed(4) : "—")} />
              <ReferenceLine x={0.25} stroke="#dc2626" strokeDasharray="4 4" />
              <Bar dataKey="psi_score" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-1">Feature</th>
                <th className="px-2 py-1">PSI</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.feature_name} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-700">{f.feature_name}</td>
                  <td className="px-2 py-2 text-slate-600">{f.psi_score != null ? f.psi_score.toFixed(4) : "—"}</td>
                  <td className="px-2 py-2"><Badge tone={STATUS_TONE[f.status] || "slate"}>{f.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <EmptyState
          title="No drift data yet"
          description={drift?.note || "Run the pipeline and train a model to populate this panel."}
        />
      )}
    </Card>
  );
}

export default FeatureDriftPanel;
