// The three DMC flood-stage thresholds attached to every river gauge
// reading (backend parses AlertLevel / MinorFloodLevel / MajorFloodLevel
// from the DMC report). Kept in sync with
// flood-frontend/src/utils/riverLevels.js.
export const FLOOD_LEVELS = [
  { key: "AlertLevel", label: "Alert level", shortLabel: "Alert", tone: "text-amber-600" },
  { key: "MinorFloodLevel", label: "Minor flood level", shortLabel: "Minor", tone: "text-orange-600" },
  { key: "MajorFloodLevel", label: "Major flood level", shortLabel: "Major", tone: "text-red-600" },
];

export function formatLevel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} m` : "—";
}
