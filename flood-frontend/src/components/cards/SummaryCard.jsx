const TONES = {
  blue: "bg-brand-soft text-brand",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  slate: "bg-surface-3 text-muted",
};

/**
 * Compact KPI tile. `icon` and `tone` are optional; `hint` renders a small
 * caption under the value; `accent` shows a coloured left rule.
 */
function SummaryCard({ title, value, icon: Icon, tone = "blue", hint, action }) {
  return (
    <div className="card card-hover flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-heading">{value}</p>
        {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
      {Icon ? (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            TONES[tone] || TONES.blue
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
    </div>
  );
}

export default SummaryCard;
