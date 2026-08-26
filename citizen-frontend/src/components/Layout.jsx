import { NavLink, Link, Outlet } from "react-router-dom";
import { FiHome, FiCloudRain, FiActivity, FiCalendar, FiUser, FiLogIn } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

const TABS = [
  { to: "/", label: "Home", icon: FiHome, end: true },
  { to: "/weather", label: "Weather", icon: FiCloudRain },
  { to: "/rivers", label: "Rivers", icon: FiActivity },
  { to: "/forecast", label: "Forecast", icon: FiCalendar },
];

function Layout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🌊</span>
            <span className="text-base font-bold leading-tight text-slate-800 sm:text-lg">
              Sri Lanka Flood Watch
            </span>
          </Link>

          {/* Desktop / tablet primary nav - the mobile equivalent is the
              bottom tab bar below. */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <NotificationBell />
            {user ? (
              <Link
                to="/account"
                className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                <FiUser className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-24 truncate">{user.full_name.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <FiLogIn className="h-4 w-4" aria-hidden="true" />
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-12">
        <Outlet />
      </main>

      {/* Mobile-only bottom tab bar. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-slate-200 bg-white md:hidden"
        aria-label="Primary"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                  isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? "scale-110" : ""} transition`} aria-hidden="true" />
                  {tab.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default Layout;
