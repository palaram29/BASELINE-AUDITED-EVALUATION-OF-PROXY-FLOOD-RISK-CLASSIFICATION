import { FLOOD_LEVELS, formatLevel } from "../../utils/riverLevels";

function StatusTimeline({ river = [] }) {
  const items = river.slice(0, 4);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <h3 className="text-lg font-semibold text-slate-800">River status highlights</h3>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${item.River}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-700">{item.River} • {item.Station}</p>
              <p className="text-sm text-slate-500">Water level {item.WaterLevel} m</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {FLOOD_LEVELS.map((level) => (
                  <span key={level.key}>
                    {level.shortLabel} <span className={level.tone}>{formatLevel(item[level.key])}</span>
                  </span>
                ))}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${item.Status === "Alert" ? "bg-red-100 text-red-700" : item.Status === "Watch" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
              {item.Status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusTimeline;
