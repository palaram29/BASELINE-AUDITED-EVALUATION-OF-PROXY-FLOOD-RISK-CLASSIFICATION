import { FiMenu } from "react-icons/fi";
import LivePulse from "../dashboard/LivePulse";
import usePipelineStatus from "../../hooks/usePipelineStatus";

// Derives the Navbar's live-status pill from the scheduler's real run
// history (GET /system/status), not a hardcoded claim. "live" only when
// the automatic pipeline has actually succeeded recently; "warning" if
// it's stale, failed, or hasn't run yet; "offline" if the backend can't
// even be reached to ask.
function deriveLiveStatus(status, statusError) {
  if (statusError) return "offline";
  if (!status || !status.last_run_at) return "warning";
  if (status.last_result !== "success") return "warning";

  const staleAfterMs = (status.interval_minutes ?? 60) * 2 * 60 * 1000;
  const age = Date.now() - new Date(status.last_success_at).getTime();
  return age <= staleAfterMs ? "live" : "warning";
}

function Navbar({ onMenuClick }) {
  const { status, error: statusError } = usePipelineStatus();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-800 sm:text-xl">Cloud Flood Prediction System</h1>
          <p className="hidden text-sm text-slate-500 sm:block">Final Year Research • Sri Lanka</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LivePulse status={deriveLiveStatus(status, statusError)} />
        <div className="hidden rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 md:block">
          Monitoring portal
        </div>
      </div>
    </header>
  );
}

export default Navbar;
