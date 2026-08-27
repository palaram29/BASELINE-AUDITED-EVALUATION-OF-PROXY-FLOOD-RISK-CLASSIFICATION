import { FiAlertTriangle } from "react-icons/fi";

function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <span className="flex items-center gap-2">
        <FiAlertTriangle className="h-4 w-4 shrink-0" />
        {message}
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default ErrorMessage;
