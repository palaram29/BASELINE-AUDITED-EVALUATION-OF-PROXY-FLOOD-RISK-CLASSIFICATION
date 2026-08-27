const CONFIG = {
  live: { dot: "bg-emerald-500", label: "Live feed active" },
  warning: { dot: "bg-amber-500", label: "Monitoring delayed" },
  offline: { dot: "bg-red-500", label: "Offline" },
};

function LivePulse({ status = "live" }) {
  const cfg = CONFIG[status] || CONFIG.offline;

  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-sm">
      <span className="relative flex h-2.5 w-2.5">
        {status === "live" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
      </span>
      <span className="text-sm font-medium text-body">{cfg.label}</span>
    </div>
  );
}

export default LivePulse;
