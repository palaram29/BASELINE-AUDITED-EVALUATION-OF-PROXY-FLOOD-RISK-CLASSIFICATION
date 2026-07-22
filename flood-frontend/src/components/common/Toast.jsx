import { useEffect } from "react";

function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose?.(), 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`fixed right-4 top-20 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${tones[type]}`}>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export default Toast;
