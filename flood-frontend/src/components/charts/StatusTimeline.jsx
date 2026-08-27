import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { FLOOD_LEVELS, formatLevel } from "../../utils/riverLevels";

function statusTone(status) {
  if (status === "Alert") return "red";
  if (status === "Watch") return "yellow";
  return "green";
}

function StatusTimeline({ river = [] }) {
  const items = river.slice(0, 6);

  return (
    <Card title="River status highlights" subtitle="Most recent readings by station">
      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={`${item.River}-${index}`}
              className="rounded-xl border border-line bg-surface-2 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-heading">{item.River}</p>
                  <p className="truncate text-xs text-muted">{item.Station}</p>
                </div>
                <Badge tone={statusTone(item.Status)} size="sm" dot>
                  {item.Status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-body">
                Water level <span className="font-semibold">{item.WaterLevel} m</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {FLOOD_LEVELS.map((level) => (
                  <span key={level.key}>
                    {level.shortLabel}{" "}
                    <span className={level.tone}>{formatLevel(item[level.key])}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No stations" description="River readings will appear here." />
      )}
    </Card>
  );
}

export default StatusTimeline;
