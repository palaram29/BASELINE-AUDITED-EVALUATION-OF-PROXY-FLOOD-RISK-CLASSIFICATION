import { Link } from "react-router-dom";
import LivePulse from "../dashboard/LivePulse";
import { useAuth } from "../../context/AuthContext";

function Navbar() {
  const { user, loading } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Cloud Flood Prediction System</h1>
        <p className="text-sm text-slate-500">Final Year Research • Sri Lanka</p>
      </div>

      <div className="flex items-center gap-3">
        <LivePulse status="live" />
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