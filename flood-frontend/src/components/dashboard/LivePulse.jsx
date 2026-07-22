function LivePulse({ status = "live" }) {
  const tone = status === "live" ? "bg-green-500" : status === "warning" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span className="text-sm font-medium text-slate-700">{status === "live" ? "Live feed active" : status === "warning" ? "Monitoring delayed" : "Offline"}</span>
    </div>
  );
}

export default LivePulse;
