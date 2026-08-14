import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getMyAlert } from "../../services/alertService";

const TONE_CLASSES = {
  "Very High": "border-red-200 bg-red-50 text-red-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Medium: "border-yellow-200 bg-yellow-50 text-yellow-800",
  Low: "border-green-200 bg-green-50 text-green-800",
};

/**
 * Personalized flood-alert banner for the logged-in user's chosen city.
 * Renders nothing at all (no API call, no layout change) when nobody is
 * logged in, so it's purely additive to the existing Dashboard.
 */
function UserAlertBanner() {
  const { user, loading: authLoading } = useAuth();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    let isMounted = true;
    const fetchAlert = () => {
      getMyAlert()
        .then((data) => {
          if (isMounted) setAlert(data);
        })
        .catch(() => {
          if (isMounted) setAlert(null);
        });
    };

    fetchAlert();
    const interval = setInterval(fetchAlert, 45000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  if (authLoading || !user || !alert || !alert.has_data) {
    return null;
  }

  const toneClass = TONE_CLASSES[alert.risk_level] || TONE_CLASSES.Low;

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${toneClass}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Your flood alert</p>
        <p className="mt-1 text-sm font-medium">{alert.message}</p>
      </div>
      <Link to="/account" className="shrink-0 text-sm font-semibold underline underline-offset-2">
        Manage alert
      </Link>
    </div>
  );
}

export default UserAlertBanner;
