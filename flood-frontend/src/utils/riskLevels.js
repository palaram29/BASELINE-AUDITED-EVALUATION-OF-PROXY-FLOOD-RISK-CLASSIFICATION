// Canonical flood-risk vocabulary shared by the map, badges and legends.
// Two backend subsystems use two DIFFERENT top-tier words for the same
// concept: river monitoring emits "Very High" (river_risk_engine.py,
// extract_river_data.py's get_river_risk()), while the ML prediction model
// emits "Extreme" (its label_encoder is fit on ML/data/train_dataset.csv's
// Flood_Risk column, whose classes are Low/Medium/High/Extreme - not Very
// High). Older UI code and demo data also use "Moderate"/"Severe"
// synonyms. Everything must funnel through normalizeRisk() before being
// colored/labeled/toned, or "Extreme" predictions silently fall through to
// "Low" (green) instead of the most severe tier.
export const RISK_LEVELS = ["Very High", "High", "Medium", "Low"];

export const RISK_COLORS = {
  "Very High": "#dc2626", // red
  High: "#f97316", // orange
  Medium: "#eab308", // yellow
  Low: "#16a34a", // green
};

export const RISK_LABELS = {
  "Very High": "Critical",
  High: "High",
  Medium: "Moderate",
  Low: "Low",
};

export function normalizeRisk(raw) {
  const value = (raw || "").toString().trim().toLowerCase();
  if (value.includes("very") || value.includes("extreme") || value.includes("severe") || value.includes("critical")) return "Very High";
  if (value.includes("high")) return "High";
  if (value.includes("medium") || value.includes("moderate")) return "Medium";
  return "Low";
}

// Fallback for stations missing a RiverRisk field: derive it from the
// gauge Status text using the same tiers as extract_river_data.py's
// get_river_risk() (Normal->Low, Alert->Medium, Minor Flood->High, Major Flood->Very High).
export function statusToRisk(status) {
  const value = (status || "").toString().trim().toLowerCase();
  if (value.includes("major")) return "Very High";
  if (value.includes("minor")) return "High";
  if (value.includes("alert")) return "Medium";
  return "Low";
}
