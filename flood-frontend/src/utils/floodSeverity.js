import { normalizeRisk, statusToRisk } from "./riskLevels";

// Continuous Green -> Yellow -> Orange -> Red gradient stops, reusing the
// same hex values as the discrete RISK_COLORS tiers so the legend and the
// smooth gradient always agree on what "red" or "yellow" means.
const GRADIENT_STOPS = [
  { t: 0, rgb: [22, 163, 74] }, // #16a34a green
  { t: 0.33, rgb: [234, 179, 8] }, // #eab308 yellow
  { t: 0.66, rgb: [249, 115, 22] }, // #f97316 orange
  { t: 1, rgb: [220, 38, 38] }, // #dc2626 red
];

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Maps a continuous severity score (0..1) to an RGB color by walking the
// gradient stops, instead of snapping to one of 4 discrete tier colors.
export function severityToColor(score) {
  const t = Math.min(1, Math.max(0, score));
  let lower = GRADIENT_STOPS[0];
  let upper = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (t >= GRADIENT_STOPS[i].t && t <= GRADIENT_STOPS[i + 1].t) {
      lower = GRADIENT_STOPS[i];
      upper = GRADIENT_STOPS[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const f = (t - lower.t) / span;
  const rgb = [0, 1, 2].map((i) => Math.round(lerp(lower.rgb[i], upper.rgb[i], f)));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function severityToCategory(score) {
  if (score >= 0.75) return "Critical";
  if (score >= 0.5) return "High";
  if (score >= 0.25) return "Moderate";
  return "Low";
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Computes a continuous 0..1 flood-severity score for a river station from
 * its actual reported data, rather than assigning a color at random or
 * snapping straight to one of 4 fixed tiers:
 *
 *  - base (45%): the station's own RiverRisk/Status classification, since
 *    that already IS the system's flood-risk score where available.
 *  - threshold (25%): how close the current water level is to the
 *    MajorFloodLevel, relative to AlertLevel - i.e. how far into the
 *    danger band the reading already sits.
 *  - rise (20%): the rate of increase since the previous reading - a
 *    station rising fast is more urgent than one holding steady at the
 *    same level.
 *  - rainfall (10%): recent rainfall at the station, a leading indicator
 *    for water levels that haven't caught up yet.
 *
 * Any missing field just contributes 0 to its term rather than breaking
 * the score, so this degrades gracefully on incomplete reports.
 */
export function computeStationSeverity(station) {
  const baseRisk = normalizeRisk(station.RiverRisk || statusToRisk(station.Status));
  const baseScore = { Low: 0.15, Medium: 0.45, High: 0.7, "Very High": 0.9 }[baseRisk];

  const waterLevel = Number(station.WaterLevel);
  const previousLevel = Number(station.PreviousWaterLevel);
  const alertLevel = Number(station.AlertLevel);
  const majorLevel = Number(station.MajorFloodLevel);
  const rainfall = Number(station.Rainfall);

  let thresholdScore = 0;
  if (Number.isFinite(waterLevel) && Number.isFinite(alertLevel) && Number.isFinite(majorLevel) && majorLevel !== alertLevel) {
    thresholdScore = clamp01((waterLevel - alertLevel) / (majorLevel - alertLevel));
  }

  let riseScore = 0;
  if (Number.isFinite(waterLevel) && Number.isFinite(previousLevel)) {
    riseScore = clamp01((waterLevel - previousLevel) / 0.5);
  }

  let rainfallScore = 0;
  if (Number.isFinite(rainfall)) {
    rainfallScore = clamp01(rainfall / 50);
  }

  const score = clamp01(0.45 * baseScore + 0.25 * thresholdScore + 0.2 * riseScore + 0.1 * rainfallScore);

  return {
    score,
    color: severityToColor(score),
    category: severityToCategory(score),
    breakdown: { baseScore, thresholdScore, riseScore, rainfallScore },
  };
}
