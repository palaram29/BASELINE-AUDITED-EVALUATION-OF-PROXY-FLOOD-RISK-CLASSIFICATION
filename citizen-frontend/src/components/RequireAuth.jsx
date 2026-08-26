import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Spinner from "./common/Spinner";

// Gates the account-only pages (Account, Notifications). Sends anonymous
// visitors to /login and remembers where they were headed.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default RequireAuth;
