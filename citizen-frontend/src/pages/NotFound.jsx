import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">🌊</span>
      <h1 className="text-lg font-bold text-slate-800">Page not found</h1>
      <p className="text-sm text-slate-500">That page doesn't exist in the flood app.</p>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        Back to home
      </Link>
    </div>
  );
}

export default NotFound;
