function ViewToggle({
  value,
  onChange,
  liveLabel = "Live",
  tomorrowLabel = "Tomorrow",
  options: customOptions,
  ariaLabel = "Live or tomorrow view",
  className = "",
}) {
  const options = customOptions || [
    { key: "live", label: liveLabel },
    { key: "tomorrow", label: tomorrowLabel },
  ];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 rounded-full border border-line bg-surface-2 p-1 ${className}`}
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
              active
                ? "bg-brand text-brand-contrast shadow-sm"
                : "text-muted hover:text-heading"
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
