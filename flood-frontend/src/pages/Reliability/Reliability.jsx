import { useState } from "react";
import useReliability from "../../hooks/useReliability";
import PageHeader from "../../components/common/PageHeader";
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
    <div className="card space-y-4 p-6">
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
    <Card
      title="Recent validation flags"
      subtitle="Flagged for audit, never deleted from weather_data / river_data"
    >
      {flags?.length ? (
        <div className="-mx-2 max-h-[32rem] overflow-auto rounded-xl border border-line sm:mx-0">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>Source</th>
                <th>Field</th>
                <th>Observed value</th>
                <th>Issue</th>
                <th>Record time</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id}>
                  <td>{f.source}</td>
                  <td className="text-muted">{f.field_name}</td>
                  <td className="text-muted">{f.observed_value ?? "—"}</td>
                  <td>
                    <Badge tone={ISSUE_TONE[f.issue_type] || "slate"}>{f.issue_type}</Badge>
                  </td>
                  <td className="text-muted">
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
      <PageHeader
        eyebrow="Machine Learning"
        title="Data reliability"
        description="Reliability = 0.25×Completeness + 0.25×Timeliness + 0.25×Validity + 0.25×Historical Reliability, computed per source (one per city for weather, one per river:station for river). A data-quality signal, distinct from model prediction confidence."
        meta={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : undefined}
      />

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
