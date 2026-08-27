import { NavLink } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { NAV_GROUPS } from "./navConfig";

function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Backdrop: only rendered on mobile while the drawer is open */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800/60 bg-slate-950 text-slate-300 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-lg shadow-lg shadow-sky-900/40">
              🌊
            </span>
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-sky-300">
                Flood AI Lab
              </p>
              <h2 className="text-lg font-semibold text-white">Prediction Console</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "bg-sky-600/90 text-white shadow-lg shadow-sky-900/30"
                            : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`h-[18px] w-[18px] shrink-0 ${
                              isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                            }`}
                          />
                          {link.label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800/60 px-6 py-4 text-xs text-slate-500">
          Research-grade monitoring platform
          <br />
          Sri Lanka · Final Year Project
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
