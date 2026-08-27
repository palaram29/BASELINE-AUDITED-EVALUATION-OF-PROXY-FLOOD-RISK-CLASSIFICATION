import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { FLOOD_LEVELS, formatLevel } from "../../utils/riverLevels";

function statusTone(status) {
  if (status === "Alert") return "red";
  if (status === "Watch") return "yellow";
  return "green";
}

function RiverTable({ rivers = [] }) {
  return (
    <Card title="River monitoring" subtitle="Water level and flood thresholds per station">
      {rivers.length ? (
        <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>River</th>
                <th>Station</th>
                <th>Water level</th>
                {FLOOD_LEVELS.map((level) => (
                  <th key={level.key}>{level.label}</th>
                ))}
                <th>Status</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rivers.map((river, index) => (
                <tr key={river.id ?? `${river.River}-${river.Station}-${index}`}>
                  <td>{river.River}</td>
                  <td>{river.Station}</td>
                  <td>{river.WaterLevel} m</td>
                  {FLOOD_LEVELS.map((level) => (
                    <td key={level.key} className={level.tone}>
                      {formatLevel(river[level.key])}
                    </td>
                  ))}
                  <td>
                    <Badge tone={statusTone(river.Status)} dot>
                      {river.Status}
                    </Badge>
                  </td>
                  <td className="text-muted">{river.RiverRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No river data" description="Station readings appear here after the next automatic collection." />
      )}
    </Card>
  );
}

export default RiverTable;
