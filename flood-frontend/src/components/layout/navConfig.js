import {
  FiGrid,
  FiCloudRain,
  FiActivity,
  FiTrendingUp,
  FiBarChart2,
  FiRefreshCw,
  FiCpu,
  FiServer,
  FiShield,
  FiUsers,
  FiInfo,
} from "react-icons/fi";

// Grouped navigation. Shared by the Sidebar (renders the groups) and the
// Navbar (looks up the current route's title + description).
export const NAV_GROUPS = [
  {
    label: "Monitoring",
    items: [
      { to: "/", label: "Dashboard", icon: FiGrid, description: "Live conditions and next-day flood-risk forecast" },
      { to: "/weather", label: "Weather", icon: FiCloudRain, description: "Latest weather conditions across Sri Lanka" },
      { to: "/river", label: "River", icon: FiActivity, description: "Water levels and flow risk by station" },
      { to: "/prediction", label: "Prediction", icon: FiTrendingUp, description: "Model flood-risk forecast for each monitored city" },
      { to: "/statistics", label: "Statistics", icon: FiBarChart2, description: "Data coverage and flood-risk footprint" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: FiRefreshCw, description: "Automatic data-refresh scheduler status" },
    ],
  },
  {
    label: "Machine Learning",
    items: [
      { to: "/ml-dashboard", label: "ML Dashboard", icon: FiCpu, description: "Algorithm comparison and production model" },
      { to: "/mlops", label: "MLOps", icon: FiServer, description: "Model lifecycle, drift and data quality" },
      { to: "/reliability", label: "Data Reliability", icon: FiShield, description: "Per-source data-quality scoring and audit trail" },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "User Management", icon: FiUsers, description: "Citizen-app registrations and their area risk" },
      { to: "/about", label: "About", icon: FiInfo, description: "About this research platform" },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname) {
  return (
    NAV_ITEMS.find((item) => item.to === pathname) ||
    NAV_ITEMS.find((item) => item.to !== "/" && pathname.startsWith(item.to))
  );
}
