import { FiChevronRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "./common/Card";
import Badge from "./common/Badge";
import { normalizeRisk, riskLabel, riskRank } from "../utils/risk";

const TONE = { Low: "green", Medium: "amber", High: "orange", "Very High": "red" };

function rankElevated(rows, riskKey) {
  return [...rows]
    .map((row) => ({ city: row.City, risk: normalizeRisk(row[riskKey]) }))
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk))
    .filter((row) => riskRank(row.risk) >= 1)
    .slice(0, 5);
}

function Section({ title, period, elevated }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {elevated.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          All monitored areas are <strong>Low</strong> flood risk {period}.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {elevated.map((row) => (
            <li key={row.city} className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{row.city}</span>
              <Badge tone={TONE[row.risk]}>{riskLabel(row.risk)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "Where is it riskiest" list. Shows the rule-based same-day index (now)
// and the ML next-day forecast (tomorrow) side by side.
function NationalSnapshot({ predictions = [], liveRisk = [] }) {
  const now = rankElevated(liveRisk, "Risk_Level");
  const tomorrow = rankElevated(predictions, "Predicted_Risk");

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Highest flood risk</h2>
        <Link
          to="/forecast"
          className="flex shrink-0 items-center whitespace-nowrap text-xs font-medium text-blue-600"
        >
          All areas <FiChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-3 space-y-4">
        {liveRisk.length ? <Section title="Right now" period="right now" elevated={now} /> : null}
        <Section title="Tomorrow (forecast)" period="for tomorrow" elevated={tomorrow} />
      </div>
    </Card>
  );
}

export default NationalSnapshot;
