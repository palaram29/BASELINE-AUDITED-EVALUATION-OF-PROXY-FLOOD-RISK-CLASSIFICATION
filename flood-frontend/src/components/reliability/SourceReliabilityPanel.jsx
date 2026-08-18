import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { RELIABILITY_TONE } from "./ReliabilityScoreCard";

function pct(value) {
  return value != null ? `${Math.round(value * 100)}%` : "—";
}

// Full per-source breakdown: every scored City (weather) / River:Station
// (river) with its own Completeness/Timeliness/Validity/Historical
// Reliability components alongside the combined score - the detailed view
// behind the compact ReliabilityScoreCard shown on the main Dashboard.
function SourceReliabilityPanel({ sources, selectedSource, onSelectSource }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Source Reliability</h3>
        <span className="text-xs text-slate-400">{sources?.length || 0} sources</span>
      </div>

      {sources?.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Completeness</th>
                <th className="px-2 py-1">Timeliness</th>
                <th className="px-2 py-1">Validity</th>
                <th className="px-2 py-1">Historical</th>
                <th className="px-2 py-1">Reliability</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr
                  key={`${s.source_type}:${s.source}`}
                  onClick={() => onSelectSource?.(s.source)}
                  className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                    selectedSource === s.source ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 py-2 font-medium text-slate-700">{s.source}</td>
                  <td className="px-2 py-2 text-slate-500 capitalize">{s.source_type}</td>
                  <td className="px-2 py-2 text-slate-600">{pct(s.completeness_score)}</td>
                  <td className="px-2 py-2 text-slate-600">{pct(s.timeliness_score)}</td>
                  <td className="px-2 py-2 text-slate-600">{pct(s.validity_score)}</td>
                  <td className="px-2 py-2 text-slate-600">{pct(s.historical_reliability_score)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-800">{pct(s.reliability_score)}</td>
                  <td className="px-2 py-2">
                    <Badge tone={RELIABILITY_TONE[s.reliability_level] || "slate"}>{s.reliability_level}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No sources scored yet"
          description="These populate after the first scheduled pipeline run."
        />
      )}
    </Card>
  );
}

export default SourceReliabilityPanel;
