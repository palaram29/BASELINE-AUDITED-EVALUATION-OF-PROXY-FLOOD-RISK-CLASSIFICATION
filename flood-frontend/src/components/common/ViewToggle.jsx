function ViewToggle({ value, onChange, liveLabel = "Live", tomorrowLabel = "Tomorrow", className = "" }) {
  const options = [
    { key: "live", label: liveLabel },
    { key: "tomorrow", label: tomorrowLabel },
  ];

  return (
    <div
      role="tablist"
      aria-label="Live or tomorrow view"
      className={`inline-flex shrink-0 rounded-full bg-slate-100 p-1 ${className}`}
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
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-800"
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
