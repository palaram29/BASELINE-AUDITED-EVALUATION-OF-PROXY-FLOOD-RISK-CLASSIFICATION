import { Link } from "react-router-dom";
import LivePulse from "../dashboard/LivePulse";
import { useAuth } from "../../context/AuthContext";
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

function Navbar() {
  const { user, loading } = useAuth();
  const { status, error: statusError } = usePipelineStatus();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Cloud Flood Prediction System</h1>
        <p className="text-sm text-slate-500">Final Year Research • Sri Lanka</p>
      </div>

      <div className="flex items-center gap-3">
        <LivePulse status={deriveLiveStatus(status, statusError)} />
        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          Monitoring portal
        </div>
        {loading ? null : user ? (
          <Link
            to="/account"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {user.full_name.split(" ")[0]}
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Get alerts
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;