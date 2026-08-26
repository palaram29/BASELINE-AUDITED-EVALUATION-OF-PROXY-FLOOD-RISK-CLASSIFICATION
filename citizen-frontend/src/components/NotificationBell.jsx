import { Link } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";

// Header bell with an unread count. Renders nothing for anonymous
// visitors (they have no alerts and no /notifications access).
function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications({ intervalMs: 60000 });

  if (!user) return null;

  return (
    <Link
      to="/alerts"
      className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
      aria-label={unreadCount > 0 ? `Alerts, ${unreadCount} unread` : "Alerts"}
    >
      <FiBell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export default NotificationBell;
