import { NavLink } from "react-router-dom";

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
  { to: "/about", label: "About" },
];

function Sidebar() {
  return (
    <aside className="flex w-72 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-300">Flood AI Lab</p>
        <h2 className="mt-2 text-2xl font-semibold">Prediction Console</h2>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
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
  );
}

export default Sidebar;