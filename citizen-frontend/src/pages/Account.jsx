import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiLogOut, FiChevronRight, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import Card from "../components/common/Card";
import ErrorMessage from "../components/common/ErrorMessage";
import LocationPicker from "../components/LocationPicker";
import { useAuth } from "../hooks/useAuth";
import { getCities, updateAlertCity, updateProfile } from "../services/authService";
import { formatDate } from "../utils/format";

function Account() {
  const { user, logout, updateUser, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(user?.alert_city || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [profileForm, setProfileForm] = useState({
    fullName: user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Keep the area picker and the profile form in step with the user
  // record if it loads/changes (e.g. after the initial async load).
  const [syncedUser, setSyncedUser] = useState(user);
  if (user !== syncedUser) {
    setSyncedUser(user);
    if (user) {
      setSelectedCity(user.alert_city);
      setProfileForm({ fullName: user.full_name || "", email: user.email || "", phone: user.phone || "" });
    }
  }

  useEffect(() => {
    getCities()
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSaveArea = async (event) => {
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

  const profileChanged =
    user &&
    (profileForm.fullName.trim() !== (user.full_name || "") ||
      profileForm.email.trim() !== (user.email || "") ||
      profileForm.phone.trim() !== (user.phone || ""));

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const updated = await updateProfile({
        fullName: profileForm.fullName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      });
      updateUser(updated);
      setProfileMessage("Your profile has been updated.");
    } catch (err) {
      setProfileError(
        err.response?.data?.detail || "Couldn't update your profile. Please try again."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount(deletePassword);
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.detail || "Couldn't delete your account. Check your password and try again.");
    } finally {
      setDeleting(false);
    }
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
        <form onSubmit={handleSaveProfile} className="mt-3 space-y-3">
          {profileError ? <ErrorMessage message={profileError} /> : null}

          <div>
            <label htmlFor="account-name" className="mb-1 block text-xs text-slate-500">Full name</label>
            <input
              id="account-name"
              required
              value={profileForm.fullName}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="account-email" className="mb-1 block text-xs text-slate-500">Email</label>
            <input
              id="account-email"
              required
              type="email"
              value={profileForm.email}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="account-phone" className="mb-1 block text-xs text-slate-500">Phone</label>
            <input
              id="account-phone"
              type="tel"
              value={profileForm.phone}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Not provided"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <span className="text-xs text-slate-500">Member since</span>
            <p className="mt-0.5 text-sm font-medium text-slate-800">
              {user.created_at ? formatDate(user.created_at) : "—"}
            </p>
          </div>

          <button
            type="submit"
            disabled={profileSaving || !profileChanged}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
          {profileMessage ? <p className="text-sm text-slate-500">{profileMessage}</p> : null}
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Alert area
        </h2>
        <form onSubmit={handleSaveArea} className="mt-3 space-y-3">
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

      <Card className="border-red-200">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-red-600">
          <FiAlertTriangle className="h-4 w-4" aria-hidden="true" /> Danger zone
        </h2>

        {!confirmingDelete ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Permanently delete your account, your alert subscription, and your notification history.
            </p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <FiTrash2 className="h-4 w-4" aria-hidden="true" /> Delete my account
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeleteAccount} className="mt-3 space-y-3">
            {deleteError ? <ErrorMessage message={deleteError} /> : null}
            <p className="text-sm text-slate-600">
              This can't be undone. Enter your password to permanently delete your account.
            </p>
            <div>
              <label htmlFor="delete-password" className="mb-1 block text-xs text-slate-500">Password</label>
              <input
                id="delete-password"
                required
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={deleting || !deletePassword}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, permanently delete my account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

export default Account;
