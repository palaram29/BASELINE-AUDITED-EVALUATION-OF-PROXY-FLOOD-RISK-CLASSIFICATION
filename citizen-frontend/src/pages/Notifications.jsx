import { useEffect, useRef } from "react";
import { FiBellOff, FiCheck } from "react-icons/fi";
import useNotifications from "../hooks/useNotifications";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Spinner from "../components/common/Spinner";
import ErrorMessage from "../components/common/ErrorMessage";
import { normalizeRisk, riskLabel } from "../utils/risk";
import { timeAgo, formatDate } from "../utils/format";

const TONE = { Low: "green", Medium: "amber", High: "orange", "Very High": "red" };

function Notifications() {
  const { items, unreadCount, loading, error, refresh, markAllRead } = useNotifications({
    intervalMs: 60000,
  });

  // Opening this screen counts as reading the alerts - mark them read
  // once, after the first load that actually has unread items.
  const markedRef = useRef(false);
  useEffect(() => {
    if (!markedRef.current && !loading && unreadCount > 0) {
      markedRef.current = true;
      markAllRead();
    }
  }, [loading, unreadCount, markAllRead]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Your flood alerts</h1>
          <p className="mt-1 text-sm text-slate-500">
            You're alerted when your area's risk rises. Alerts appear here.
          </p>
        </div>
        {items.some((item) => !item.is_read) ? (
          <button
            type="button"
            onClick={markAllRead}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <FiCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark read
          </button>
        ) : null}
      </div>

      {error ? <ErrorMessage message={error} onRetry={refresh} /> : null}

      {loading && !items.length ? (
        <Spinner label="Loading your alerts…" />
      ) : items.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FiBellOff className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">No alerts yet</p>
            <p className="text-xs text-slate-500">
              That's good news — we'll notify you here if the flood risk for your area rises.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const risk = normalizeRisk(item.risk_level);
            return (
              <li key={item.id}>
                <Card className={item.is_read ? "" : "border-blue-300 ring-1 ring-blue-200"}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                    <Badge tone={TONE[risk]}>{riskLabel(risk)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{timeAgo(item.created_at)}</span>
                    {item.predicted_for_date ? (
                      <span>Forecast for {formatDate(item.predicted_for_date)}</span>
                    ) : null}
                    {item.rainfall_3day != null ? (
                      <span>{item.rainfall_3day} mm 3-day rain</span>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Notifications;
