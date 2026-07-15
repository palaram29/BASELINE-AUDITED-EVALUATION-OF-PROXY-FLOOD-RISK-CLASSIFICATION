import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="w-64 bg-blue-900 text-white">
      <div className="text-2xl font-bold p-6 border-b border-blue-800">
        Flood System
      </div>

      <nav className="flex flex-col p-4 gap-2">

        <NavLink to="/">Dashboard</NavLink>

        <NavLink to="/weather">Weather</NavLink>

        <NavLink to="/river">River</NavLink>

        <NavLink to="/prediction">Prediction</NavLink>

        <NavLink to="/statistics">Statistics</NavLink>

        <NavLink to="/pipeline">Pipeline</NavLink>

        <NavLink to="/about">About</NavLink>

      </nav>
    </aside>
  );
}

export default Sidebar;