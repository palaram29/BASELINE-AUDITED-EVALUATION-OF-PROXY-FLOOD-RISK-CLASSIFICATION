import { useState } from "react";
import useReliability from "../../hooks/useReliability";
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";
import ReliabilityScoreCard from "../../components/reliability/ReliabilityScoreCard";
import SourceReliabilityPanel from "../../components/reliability/SourceReliabilityPanel";
import ReliabilityHistoryChart from "../../components/reliability/ReliabilityHistoryChart";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import EmptyState from "../../components/common/EmptyState";

function LoadingCard() {
  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-md">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

const ISSUE_TONE = {
  null: "slate",
  negative_value: "red",
  invalid_range: "red",
  invalid_type: "red",
  duplicate: "orange",
  invalid_timestamp: "orange",
  missing_timestamp: "orange",
  outlier: "yellow",
};

function ValidationFlagsTable({ flags }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Recent Validation Flags</h3>
        <span className="text-xs text-slate-400">
          Suspicious/invalid records are flagged for audit, never deleted from weather_data/river_data
        </span>
      </div>

      {flags?.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Field</th>
                <th className="px-2 py-1">Observed Value</th>
                <th className="px-2 py-1">Issue</th>
                <th className="px-2 py-1">Record Time</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-700">{f.source}</td>
                  <td className="px-2 py-2 text-slate-600">{f.field_name}</td>
                  <td className="px-2 py-2 text-slate-600">{f.observed_value ?? "—"}</td>
                  <td className="px-2 py-2">
                    <Badge tone={ISSUE_TONE[f.issue_type] || "slate"}>{f.issue_type}</Badge>
                  </td>
                  <td className="px-2 py-2 text-slate-500">
                    {f.record_timestamp ? new Date(f.record_timestamp).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No flagged records" description="Nothing suspicious has been detected yet." />
      )}
    </Card>
  );
}

// Data Source Reliability: per-source Completeness/Timeliness/Validity/
// Historical Reliability scoring, plus the validation audit trail - the
// research-facing deep view behind the compact widget shown on the main
// Dashboard. See backend/services/reliability_service.py.
function Reliability() {
  const { summary, sources, validationFlags, loading, error, lastUpdated } = useReliability();
  const [selectedSource, setSelectedSource] = useState(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Data Reliability</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Reliability = 0.25×Completeness + 0.25×Timeliness + 0.25×Validity + 0.25×Historical Reliability,
            computed per source (one per City for weather, one per River:Station for river). A data-quality signal,
            distinct from model prediction confidence - see the ML Dashboard for that.
          </p>
          {lastUpdated ? (
            <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdated.toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <LoadingCard />
      ) : (
        <>
          <ReliabilityScoreCard summary={summary} />

          <SourceReliabilityPanel
            sources={sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
          />

          <ReliabilityHistoryChart source={selectedSource} />

          <ValidationFlagsTable flags={validationFlags} />
        </>
      )}
    </div>
  );
}

export default Reliability;
