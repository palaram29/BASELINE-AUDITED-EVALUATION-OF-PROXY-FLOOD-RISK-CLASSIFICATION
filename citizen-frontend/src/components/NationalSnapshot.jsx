import { FiChevronRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "./common/Card";
import Badge from "./common/Badge";
import { normalizeRisk, riskLabel, riskRank } from "../utils/risk";

const TONE = { Low: "green", Medium: "amber", High: "orange", "Very High": "red" };

// Compact "where is it riskiest right now" list, built from the same
// /prediction/latest data the Forecast page shows.
function NationalSnapshot({ predictions = [] }) {
  const ranked = [...predictions]
    .map((row) => ({ city: row.City, risk: normalizeRisk(row.Predicted_Risk) }))
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk));

  const elevated = ranked.filter((row) => riskRank(row.risk) >= 1).slice(0, 5);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Highest risk tomorrow
        </h2>
        <Link
          to="/forecast"
          className="flex shrink-0 items-center whitespace-nowrap text-xs font-medium text-blue-600"
        >
          All areas <FiChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {elevated.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          All monitored areas are forecast <strong>Low</strong> flood risk for tomorrow.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {elevated.map((row) => (
            <li key={row.city} className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{row.city}</span>
              <Badge tone={TONE[row.risk]}>{riskLabel(row.risk)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default NationalSnapshot;
