import { Circle, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { RISK_LEVELS, RISK_COLORS, normalizeRisk } from "../../utils/riskLevels";

const BASE_RADIUS_METERS = 4500;
const RADIUS_STEP_METERS = 3500;

// Leaflet's default marker icons live in "markerPane" (z-index 600), above
// the "overlayPane" (z-index 400) where Circle/Polygon vector layers render
// by default. A weather/prediction pin that happens to sit near a river
// station would otherwise physically cover the ring's click/hover target, so
// the (invisible) hit-circle uses a dedicated pane above markerPane instead
// of relying on DOM mount order within a shared pane. FloodMap declares this
// pane once via <Pane name={RISK_RING_HIT_PANE} .../>.
export const RISK_RING_HIT_PANE = "risk-ring-hit-pane";

/**
 * Renders a station's flood risk as concentric rings radiating out from its
 * real lat/lng: the innermost ring is the station's current risk color, and
 * each ring outward steps down the Red -> Orange -> Yellow -> Green scale
 * toward Low, so higher-risk stations end up both redder and physically
 * larger/more prominent on the map.
 */
function RiskRings({ position, risk, tooltipContent, popupContent }) {
  const currentRisk = normalizeRisk(risk);
  const startIndex = RISK_LEVELS.indexOf(currentRisk);
  const ringLevels = RISK_LEVELS.slice(startIndex); // e.g. High -> [High, Medium, Low]
  const outerRadius = BASE_RADIUS_METERS + (ringLevels.length - 1) * RADIUS_STEP_METERS;

  // Draw largest ring first, smallest (current risk) last so it paints on
  // top - that's what makes the stack read as bands instead of one blob.
  const ringsLargestFirst = [...ringLevels].map((level, i) => ({ level, i })).reverse();

  return (
    <>
      {ringsLargestFirst.map(({ level, i }) => (
        <Circle
          key={level}
          center={position}
          radius={BASE_RADIUS_METERS + i * RADIUS_STEP_METERS}
          pathOptions={{
            color: RISK_COLORS[level],
            weight: i === 0 ? 2 : 1,
            opacity: 0.8 - i * 0.12,
            fillColor: RISK_COLORS[level],
            fillOpacity: 0.4 - i * 0.06,
            interactive: false,
          }}
        />
      ))}

      {/* Solid center dot + the interactive hit area covering all rings */}
      <Circle center={position} radius={outerRadius} pane={RISK_RING_HIT_PANE} pathOptions={{ opacity: 0, fillOpacity: 0 }}>
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95} sticky>
          {tooltipContent}
        </Tooltip>
        <Popup>{popupContent}</Popup>
      </Circle>
      <CircleMarker
        center={position}
        radius={7}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: RISK_COLORS[currentRisk],
          fillOpacity: 0.95,
          interactive: false,
        }}
      />
    </>
  );
}

export default RiskRings;
