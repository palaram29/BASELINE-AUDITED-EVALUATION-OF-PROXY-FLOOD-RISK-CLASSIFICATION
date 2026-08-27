import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-body">
      <p className="text-6xl">🌊</p>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-brand">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold text-heading">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-contrast shadow-sm transition hover:bg-brand-strong"
      >
        <FiArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </div>
  );
}

export default NotFound;
