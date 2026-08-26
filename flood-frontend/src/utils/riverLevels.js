// The three DMC flood-stage thresholds that come attached to every river
// gauge reading - backend/extract_river_data.py parses AlertLevel,
// MinorFloodLevel and MajorFloodLevel straight out of the DMC report and
// river_service returns them via SELECT *. Shared here so the dashboard
// river table, the River page table, the status highlights and the map
// popup all label, order and colour them the same way.
export const FLOOD_LEVELS = [
  { key: "AlertLevel", label: "Alert level", shortLabel: "Alert", tone: "text-amber-600" },
  { key: "MinorFloodLevel", label: "Minor flood level", shortLabel: "Minor", tone: "text-orange-600" },
  { key: "MajorFloodLevel", label: "Major flood level", shortLabel: "Major", tone: "text-red-600" },
];

// Formats a gauge level in metres, degrading to an en-dash when the DMC
// report didn't carry that threshold for a station.
export function formatLevel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} m` : "—";
}
