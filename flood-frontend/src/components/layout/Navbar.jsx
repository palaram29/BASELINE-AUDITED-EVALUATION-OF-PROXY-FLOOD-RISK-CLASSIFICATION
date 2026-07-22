import LivePulse from "../dashboard/LivePulse";

function Navbar() {
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
      </div>
    </header>
  );
}

export default Navbar;