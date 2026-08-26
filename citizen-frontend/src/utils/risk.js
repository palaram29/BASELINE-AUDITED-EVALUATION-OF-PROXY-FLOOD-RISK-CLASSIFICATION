// Citizen-facing flood-risk vocabulary. Mirrors flood-frontend's
// riskLevels.js normalizeRisk() so the two apps agree on tiers: the
// river subsystem emits "Very High", the ML model emits "Extreme", and
// older data uses "Moderate"/"Severe" - all must funnel through
// normalizeRisk() before being coloured or labelled.

export const RISK_ORDER = ["Low", "Medium", "High", "Very High"];

export function normalizeRisk(raw) {
  const value = (raw || "").toString().trim().toLowerCase();
  if (value.includes("very") || value.includes("extreme") || value.includes("severe") || value.includes("critical")) {
    return "Very High";
  }
  if (value.includes("high")) return "High";
  if (value.includes("medium") || value.includes("moderate")) return "Medium";
  return "Low";
}

// Plain words a resident understands, not model jargon.
export const RISK_LABEL = {
  Low: "Low",
  Medium: "Moderate",
  High: "High",
  "Very High": "Critical",
};

// Full palette per tier - background, text, border, accent bar - all
// defined here so nothing is colour-only (each tier also gets an icon and
// a word wherever it's shown).
export const RISK_THEME = {
  Low: {
    badge: "bg-green-100 text-green-800",
    panel: "bg-green-50 border-green-200 text-green-900",
    bar: "bg-green-500",
    dot: "bg-green-500",
  },
  Medium: {
    badge: "bg-amber-100 text-amber-900",
    panel: "bg-amber-50 border-amber-200 text-amber-900",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  High: {
    badge: "bg-orange-100 text-orange-900",
    panel: "bg-orange-50 border-orange-300 text-orange-950",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  "Very High": {
    badge: "bg-red-100 text-red-900",
    panel: "bg-red-50 border-red-300 text-red-950",
    bar: "bg-red-600",
    dot: "bg-red-600",
  },
};

// Raw hex per tier - for canvas/SVG contexts (the Leaflet map) that can't
// use the Tailwind class strings above. Same colours as RISK_THEME.
export const RISK_HEX = {
  Low: "#16a34a",
  Medium: "#d97706",
  High: "#ea580c",
  "Very High": "#dc2626",
};

export const riskTheme = (risk) => RISK_THEME[normalizeRisk(risk)] || RISK_THEME.Low;
export const riskLabel = (risk) => RISK_LABEL[normalizeRisk(risk)] || "Low";
export const riskRank = (risk) => RISK_ORDER.indexOf(normalizeRisk(risk));
export const riskHex = (risk) => RISK_HEX[normalizeRisk(risk)] || RISK_HEX.Low;
