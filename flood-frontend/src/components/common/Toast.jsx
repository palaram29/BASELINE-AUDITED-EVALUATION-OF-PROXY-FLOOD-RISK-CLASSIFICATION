import { useEffect } from "react";
import { FiInfo, FiAlertTriangle, FiAlertOctagon } from "react-icons/fi";

const TONES = {
  info: {
    wrap: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    icon: FiInfo,
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    icon: FiAlertTriangle,
  },
  danger: {
    wrap: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    icon: FiAlertOctagon,
  },
};

function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose?.(), 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const tone = TONES[type] || TONES.info;
  const Icon = tone.icon;

  return (
    <div
      role="status"
      className={`fixed right-4 top-20 z-50 flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${tone.wrap}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export default Toast;
