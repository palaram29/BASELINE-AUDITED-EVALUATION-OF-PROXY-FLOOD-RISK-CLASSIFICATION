import { FiClock } from "react-icons/fi";
import { timeAgo } from "../../utils/format";

// Honest "updated N minutes ago" label. Falls back to a plain note when
// no timestamp is available rather than implying the data is current.
function DataFreshness({ timestamp, prefix = "Updated" }) {
  const label = timestamp ? timeAgo(timestamp) : "";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <FiClock className="h-3.5 w-3.5" aria-hidden="true" />
      {label ? `${prefix} ${label}` : "Freshness unknown"}
    </span>
  );
}

export default DataFreshness;
