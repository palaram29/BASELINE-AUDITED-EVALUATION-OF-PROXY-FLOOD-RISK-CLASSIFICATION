import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getNotifications, markRead } from "../services/notificationService";

/**
 * Polls the logged-in user's flood-alert notifications. When nobody is
 * logged in it fires no requests and reports an empty list - handled by
 * deriving the return values from `user` rather than resetting state in
 * an effect.
 */
export default function useNotifications({ intervalMs = 60000 } = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!user) return undefined;

    let isMounted = true;

    const load = async () => {
      try {
        const data = await getNotifications();
        if (!isMounted) return;
        setItems(Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Couldn't load your alerts.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const id = intervalMs ? setInterval(load, intervalMs) : null;

    return () => {
      isMounted = false;
      if (id) clearInterval(id);
    };
  }, [user, intervalMs, reloadToken]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await markRead();
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  // Derived so logging out clears the view without a setState-in-effect.
  const visibleItems = user ? items : [];
  const unreadCount = visibleItems.reduce(
    (count, item) => (item.is_read ? count : count + 1),
    0
  );

  return {
    items: visibleItems,
    unreadCount,
    loading: user ? loading : false,
    error: user ? error : "",
    refresh,
    markAllRead,
  };
}
