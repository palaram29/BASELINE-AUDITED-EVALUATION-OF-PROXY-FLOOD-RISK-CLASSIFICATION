import Card from "../common/Card";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";
import EmptyState from "../common/EmptyState";
import { RELIABILITY_TONE } from "../../utils/reliabilityTone";

function pct(value) {
  return value != null ? `${Math.round(value * 100)}%` : "—";
}

function ScoreRow({ label, score, level, compact = false }) {
  return (
    <div className={compact ? "" : "border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"}>
      <div className="mb-1 flex items-center justify-between">
        <span className={compact ? "text-sm text-slate-600" : "font-medium text-slate-700"}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{pct(score)}</span>
          {level ? <Badge tone={RELIABILITY_TONE[level] || "slate"}>{level}</Badge> : null}
        </div>
      </div>
      <ProgressBar value={score || 0} tone={RELIABILITY_TONE[level] === "red" ? "yellow" : RELIABILITY_TONE[level]} />
    </div>
  );
}

// Compact "Data Reliability" widget - overall score + a Weather/River
// rollup. This is a DATA-QUALITY signal, not model confidence (Probability)
// - deliberately a separate card from the prediction panels wherever both
// appear, per §13/§14 of the Data Source Reliability integration.
function ReliabilityScoreCard({ summary }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Data Reliability</h3>
      </div>

      {summary ? (
        <div className="space-y-4">
          <ScoreRow label="Overall Data Reliability" score={summary.overall_score} level={summary.overall_level} />
          {summary.weather ? (
            <ScoreRow label="Weather Source" score={summary.weather.score} level={summary.weather.level} compact />
          ) : null}
          {summary.river ? (
            <ScoreRow label="River Source" score={summary.river.score} level={summary.river.level} compact />
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No reliability data yet"
          description="This populates after the first scheduled pipeline run."
        />
      )}
    </Card>
  );
}

export default ReliabilityScoreCard;
