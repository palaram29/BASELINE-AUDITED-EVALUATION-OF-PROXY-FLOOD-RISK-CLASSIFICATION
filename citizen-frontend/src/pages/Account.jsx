import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiLogOut, FiChevronRight } from "react-icons/fi";
import Card from "../components/common/Card";
import LocationPicker from "../components/LocationPicker";
import { useAuth } from "../hooks/useAuth";
import { getCities, updateAlertCity } from "../services/authService";
import { formatDate } from "../utils/format";

function Account() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(user?.alert_city || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Keep the picker in step with the user record if it loads/changes.
  const [syncedUser, setSyncedUser] = useState(user);
  if (user !== syncedUser) {
    setSyncedUser(user);
    if (user) setSelectedCity(user.alert_city);
  }

  useEffect(() => {
    getCities()
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateAlertCity(selectedCity);
      updateUser(updated);
      setMessage("Your area has been updated.");
    } catch {
      setMessage("Couldn't update your area. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">My account</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <FiLogOut className="h-4 w-4" aria-hidden="true" /> Log out
        </button>
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Profile</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Full name</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-0.5 font-medium text-slate-800 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Phone</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{user.phone || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Member since</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {user.created_at ? formatDate(user.created_at) : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Alert area
        </h2>
        <form onSubmit={handleSave} className="mt-3 space-y-3">
          <LocationPicker
            id="account-city"
            cities={cities}
            value={selectedCity}
            onChange={setSelectedCity}
          />
          <button
            type="submit"
            disabled={saving || !selectedCity || selectedCity === user.alert_city}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save area"}
          </button>
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
        </form>
      </Card>

      <Link
        to="/alerts"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        View your flood alert history
        <FiChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default Account;
