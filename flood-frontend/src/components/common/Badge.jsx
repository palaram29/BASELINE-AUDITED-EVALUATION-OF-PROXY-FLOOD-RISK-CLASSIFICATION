const TONES = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/20",
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/20",
  slate: "bg-surface-2 text-muted ring-line dark:ring-line",
};

const SIZES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

function Badge({ children, tone = "blue", size = "md", dot = false, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${
        TONES[tone] || TONES.blue
      } ${SIZES[size] || SIZES.md} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export default Badge;
