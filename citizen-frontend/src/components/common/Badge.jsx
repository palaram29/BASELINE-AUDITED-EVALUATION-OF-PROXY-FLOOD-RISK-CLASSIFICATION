const TONES = {
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-900",
  orange: "bg-orange-100 text-orange-900",
  red: "bg-red-100 text-red-900",
  slate: "bg-slate-100 text-slate-700",
};

function Badge({ children, tone = "blue", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone] || TONES.blue} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
