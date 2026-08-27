// Small segmented Today / Tomorrow control for the citizen app. "today"
// = the rule-based same-day risk index, "tomorrow" = the ML next-day
// forecast (see src/pages/Forecast.jsx).
function ViewToggle({ value, onChange, className = "" }) {
  const options = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Today or tomorrow flood risk"
      className={`inline-flex shrink-0 rounded-lg border border-slate-300 bg-white p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;
