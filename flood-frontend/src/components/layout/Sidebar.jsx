import { NavLink } from "react-router-dom";
import { FiX } from "react-icons/fi";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/weather", label: "Weather" },
  { to: "/river", label: "River" },
  { to: "/prediction", label: "Prediction" },
  { to: "/statistics", label: "Statistics" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/ml-dashboard", label: "ML Dashboard" },
  { to: "/mlops", label: "MLOps" },
  { to: "/reliability", label: "Data Reliability" },
  { to: "/users", label: "User Management" },
  { to: "/about", label: "About" },
];

function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Backdrop: only rendered on mobile while the drawer is open */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-blue-300">Flood AI Lab</p>
            <h2 className="mt-2 text-2xl font-semibold">Prediction Console</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center rounded-xl px-4 py-3 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white shadow-lg" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-6 text-sm text-slate-400">
          Research-grade monitoring platform
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
