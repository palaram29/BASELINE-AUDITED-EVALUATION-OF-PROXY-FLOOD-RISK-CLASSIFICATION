import { normalizeRisk } from "./riskLevels";

// Maps a raw risk value (river's "Very High", the ML model's "Extreme", or
// any other synonym normalizeRisk understands) to a Badge tone. Delegates
// to normalizeRisk so this can't drift out of sync with the vocabulary it
// accepts - a raw switch on exact strings here previously mapped "Extreme"
// predictions to the "slate" (unknown) tone instead of red. Shared by the
// ML Dashboard's live prediction panel and prediction history table.
export const riskTone = (risk) => {
  if (!risk) return "slate";

  switch (normalizeRisk(risk)) {
    case "Low":
      return "green";
    case "Medium":
      return "yellow";
    case "High":
      return "orange";
    case "Very High":
      return "red";
    default:
      return "slate";
  }
};
