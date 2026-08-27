// Small labeled progress bar used for accuracy/precision/recall/F1 on
// the Model Overview Cards.
function ProgressBar({ value = 0, tone = "blue" }) {
  const tones = {
    blue: "bg-brand",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    slate: "bg-faint",
  };

  const percent = Math.max(0, Math.min(100, value * 100));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={`h-full rounded-full transition-all duration-500 ${tones[tone] || tones.blue}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default ProgressBar;
