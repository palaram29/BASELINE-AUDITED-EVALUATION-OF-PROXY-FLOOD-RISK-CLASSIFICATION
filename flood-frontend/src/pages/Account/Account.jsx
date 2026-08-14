import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { getCities, updateAlertCity } from "../../services/authService";
import { getMyAlert } from "../../services/alertService";
import { riskTone } from "../../utils/riskTone";

function Account() {
  const { user, loading: authLoading, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(user?.alert_city || "");
  const [alert, setAlert] = useState(null);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) setSelectedCity(user.alert_city);
  }, [user]);

  const fetchAlert = () => {
    setAlertLoading(true);
    setAlertError("");
    getMyAlert()
      .then(setAlert)
      .catch(() => setAlertError("Unable to load your current flood alert status."))
      .finally(() => setAlertLoading(false));
  };

  useEffect(() => {
    fetchAlert();
    // Refresh alongside the rest of the app's live data so a change in
    // conditions for the user's city shows up without a manual reload.
    const interval = setInterval(fetchAlert, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveCity = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const updated = await updateAlertCity(selectedCity);
      updateUser(updated);
      setSaveMessage("Alert city updated.");
      fetchAlert();
    } catch {
      setSaveMessage("Could not update your alert city. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">My account</h1>
          <p className="mt-2 text-slate-500">Manage your details and flood alert preferences.</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Log out
        </button>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Profile</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Full name</dt>
            <dd className="mt-1 font-medium text-slate-800">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 font-medium text-slate-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
            <dd className="mt-1 font-medium text-slate-800">{user.phone || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Member since</dt>
            <dd className="mt-1 font-medium text-slate-800">
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Flood alert city</h2>
        <form onSubmit={handleSaveCity} className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedCity}
            onChange={(event) => setSelectedCity(event.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || selectedCity === user.alert_city}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
        {saveMessage ? <p className="mt-2 text-sm text-slate-500">{saveMessage}</p> : null}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Current flood alert — {user.alert_city}</h2>
          <button onClick={fetchAlert} className="text-sm font-medium text-blue-600 hover:underline">Refresh</button>
        </div>

        {alertLoading ? (
          <p className="text-sm text-slate-500">Checking latest conditions...</p>
        ) : alertError ? (
          <ErrorMessage message={alertError} />
        ) : alert && alert.has_data ? (
          <div className="space-y-3">
            <Badge tone={riskTone(alert.risk_level)}>{alert.risk_label} risk</Badge>
            <p className={`text-sm ${alert.is_alert ? "font-semibold text-slate-800" : "text-slate-600"}`}>
              {alert.message}
            </p>
            <div className="text-xs text-slate-400">
              {alert.rainfall_3day != null ? `3-day rainfall: ${alert.rainfall_3day} mm` : null}
              {alert.date ? ` • as of ${alert.date}` : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{alert?.message || "No prediction data available for this city yet."}</p>
        )}
      </Card>
    </div>
  );
}

export default Account;
