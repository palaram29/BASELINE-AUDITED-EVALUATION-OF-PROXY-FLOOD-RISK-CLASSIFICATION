import { useTheme } from "../context/theme";

/**
 * Theme-aware colours for Recharts. Recharts needs concrete colour strings
 * (not CSS classes), so we resolve them from the active theme here and pass
 * them into <CartesianGrid>, <XAxis>, <Tooltip> etc.
 */
export function useChartTheme() {
  const { isDark } = useTheme();

  return {
    grid: isDark ? "#26344d" : "#e3e8f0",
    axis: isDark ? "#91a0b5" : "#64748b",
    axisLine: isDark ? "#33445f" : "#d3dae5",
    brand: isDark ? "#3aa0e6" : "#0d76c4",
    series: isDark
      ? ["#3aa0e6", "#34d399", "#fbbf24", "#f87171", "#a78bfa"]
      : ["#0d76c4", "#059669", "#d97706", "#dc2626", "#7c3aed"],
    tooltip: {
      contentStyle: {
        background: isDark ? "#17233b" : "#ffffff",
        border: `1px solid ${isDark ? "#26344d" : "#e3e8f0"}`,
        borderRadius: 12,
        boxShadow: "0 12px 32px -12px rgba(2, 8, 23, 0.35)",
        color: isDark ? "#f1f5f9" : "#0f172a",
        fontSize: 13,
      },
      labelStyle: { color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 },
      itemStyle: { color: isDark ? "#c6d0de" : "#3b475c" },
      cursor: { fill: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)" },
    },
  };
}
