import { FiMenu } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import LivePulse from "../dashboard/LivePulse";
import ThemeToggle from "./ThemeToggle";
import usePipelineStatus from "../../hooks/usePipelineStatus";
import { findNavItem } from "./navConfig";

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
  const { pathname } = useLocation();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-heading sm:text-lg">
            {current?.label ?? "Cloud Flood Prediction System"}
          </h1>
          <p className="hidden truncate text-xs text-muted sm:block">
            {current?.description ?? "Final Year Research • Sri Lanka"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <LivePulse status={deriveLiveStatus(status, statusError)} />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default Navbar;
