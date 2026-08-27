import { useMemo, useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import ViewToggle from "../common/ViewToggle";
import { RELIABILITY_TONE } from "../../utils/reliabilityTone";

function pct(value) {
  return value != null ? `${Math.round(value * 100)}%` : "—";
}

const SOURCE_TYPE_OPTIONS = [
  { key: "weather", label: "Weather" },
  { key: "river", label: "River" },
];

// Full per-source breakdown: every scored City (weather) / River:Station
// (river) with its own Completeness/Timeliness/Validity/Historical
// Reliability components alongside the combined score - the detailed view
// behind the compact ReliabilityScoreCard shown on the main Dashboard.
//
// Weather and river sources use unrelated ID schemes (City name vs.
// "River:Station") and were previously listed together in one table,
// which read as a single jumbled list rather than two coherent groups.
// This toggle splits them so each type is reviewed on its own.
function SourceReliabilityPanel({ sources, selectedSource, onSelectSource }) {
  const [sourceType, setSourceType] = useState("weather");

  const filteredSources = useMemo(
    () => (sources || []).filter((s) => s.source_type === sourceType),
    [sources, sourceType]
  );

  const weatherCount = useMemo(() => (sources || []).filter((s) => s.source_type === "weather").length, [sources]);
  const riverCount = useMemo(() => (sources || []).filter((s) => s.source_type === "river").length, [sources]);

  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    // Clear the selected source (and the history chart below it) when
    // switching type, since a source from the other type is no longer
    // relevant to what's currently shown in this table.
    onSelectSource?.(null);
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-heading">Source Reliability</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-faint">
            {sourceType === "weather" ? weatherCount : riverCount} of {(sources?.length || 0)} sources
          </span>
          <ViewToggle
            value={sourceType}
            onChange={handleSourceTypeChange}
            options={SOURCE_TYPE_OPTIONS}
            ariaLabel="Filter sources by weather or river"
          />
        </div>
      </div>

      {filteredSources.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Completeness</th>
                <th className="px-2 py-1">Timeliness</th>
                <th className="px-2 py-1">Validity</th>
                <th className="px-2 py-1">Historical</th>
                <th className="px-2 py-1">Reliability</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((s) => (
                <tr
                  key={`${s.source_type}:${s.source}`}
                  onClick={() => onSelectSource?.(s.source)}
                  className={`cursor-pointer border-t border-line hover:bg-surface-2 ${
                    selectedSource === s.source ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 py-2 font-medium text-body">{s.source}</td>
                  <td className="px-2 py-2 text-muted">{pct(s.completeness_score)}</td>
                  <td className="px-2 py-2 text-muted">{pct(s.timeliness_score)}</td>
                  <td className="px-2 py-2 text-muted">{pct(s.validity_score)}</td>
                  <td className="px-2 py-2 text-muted">{pct(s.historical_reliability_score)}</td>
                  <td className="px-2 py-2 font-semibold text-heading">{pct(s.reliability_score)}</td>
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
          title={sources?.length ? `No ${sourceType} sources scored yet` : "No sources scored yet"}
          description="These populate after the first scheduled pipeline run."
        />
      )}
    </Card>
  );
}

export default SourceReliabilityPanel;
