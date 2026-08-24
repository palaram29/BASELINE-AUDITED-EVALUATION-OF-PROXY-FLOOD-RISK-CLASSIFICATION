import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useAuth } from "../../hooks/useAuth";
import { getCities } from "../../services/authService";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [cities, setCities] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    alertCity: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordTooShort = form.password.length > 0 && form.password.length < 8;
  const confirmMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  useEffect(() => {
    let isMounted = true;
    getCities()
      .then((data) => {
        if (isMounted) {
          setCities(data);
          setForm((prev) => (prev.alertCity ? prev : { ...prev, alertCity: data[0] || "" }));
        }
      })
      .catch(() => {
        if (isMounted) setError("Unable to load the list of cities. Please try again shortly.");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        alertCity: form.alertCity,
      });
      navigate("/account");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Create an account</h1>
        <p className="mt-2 text-slate-500">Register to receive personalized flood alerts for your city.</p>
      </div>

      <Card>
        {error ? <div className="mb-4"><ErrorMessage message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              id="reg-name"
              required
              value={form.fullName}
              onChange={updateField("fullName")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Perera"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="reg-email"
              required
              type="email"
              value={form.email}
              onChange={updateField("email")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
            <input
              id="reg-phone"
              type="tel"
              value={form.phone}
              onChange={updateField("phone")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="07XXXXXXXX"
            />
          </div>

          <div>
            <label htmlFor="reg-city" className="mb-1 block text-sm font-medium text-slate-700">City to receive flood alerts for</label>
            <select
              id="reg-city"
              required
              value={form.alertCity}
              onChange={updateField("alertCity")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                required
                type={showPassword ? "text" : "password"}
                minLength={8}
                value={form.password}
                onChange={updateField("password")}
                aria-invalid={passwordTooShort ? "true" : undefined}
                aria-describedby={passwordTooShort ? "reg-password-error" : undefined}
                className={`w-full rounded-lg border px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 ${
                  passwordTooShort ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                }`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
            {passwordTooShort ? (
              <p id="reg-password-error" className="mt-1 text-xs text-red-600">Must be at least 8 characters.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
            <div className="relative">
              <input
                id="reg-confirm-password"
                required
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={updateField("confirmPassword")}
                aria-invalid={confirmMismatch ? "true" : undefined}
                aria-describedby={confirmMismatch ? "reg-confirm-password-error" : undefined}
                className={`w-full rounded-lg border px-3 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 ${
                  confirmMismatch ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
            {confirmMismatch ? (
              <p id="reg-confirm-password-error" className="mt-1 text-xs text-red-600">Passwords do not match.</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting || !form.alertCity || passwordTooShort || confirmMismatch}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="font-medium text-blue-600 hover:underline">Log in</Link>
        </p>
      </Card>
    </div>
  );
}

export default Register;
