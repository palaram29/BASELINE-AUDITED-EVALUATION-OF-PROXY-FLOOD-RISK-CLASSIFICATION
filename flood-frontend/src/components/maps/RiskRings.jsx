import { Circle, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { computeStationSeverity, severityToColor } from "../../utils/floodSeverity";

const MIN_RADIUS_METERS = 2500;
const MAX_RADIUS_METERS = 22000;
const BAND_COUNT = 9;

// Leaflet's default marker icons live in "markerPane" (z-index 600), above
// the "overlayPane" (z-index 400) where Circle/Polygon vector layers render
// by default. A weather/prediction pin that happens to sit near a river
// station would otherwise physically cover the zone's click/hover target, so
// the (invisible) hit-circle uses a dedicated pane above markerPane instead
// of relying on DOM mount order within a shared pane. FloodMap declares this
// pane once via <Pane name={RISK_RING_HIT_PANE} .../>.
export const RISK_RING_HIT_PANE = "risk-ring-hit-pane";

/**
 * Renders a station's flood risk as a soft radial gradient zone radiating
 * out from its real lat/lng: the center is colored by the station's own
 * continuous severity score (computeStationSeverity - driven by water
 * level, rate of rise, rainfall and RiverRisk, not a fixed tier), and the
 * zone fades smoothly toward green at its edge, through many thin
 * concentric bands instead of a handful of hard-edged rings, so it reads as
 * a heatmap-style impact zone rather than a stack of colored circles. A
 * more severe station gets both a redder core AND a larger zone, so
 * high-risk areas stay visually dominant on the map.
 */
function RiskRings({ position, station, tooltipContent, popupContent }) {
  const { score, color } = computeStationSeverity(station);
  const outerRadius = MIN_RADIUS_METERS + score * (MAX_RADIUS_METERS - MIN_RADIUS_METERS);

  // Bands go from the outer edge (t=0, green) to the core (t=1, this
  // station's own severity color) - rendering largest-first/smallest-last
  // so the core paints on top, which is what makes the stack read as a
  // smooth glow instead of one flat blob.
  // i=0 is the largest/greenest band (the edge); i=BAND_COUNT-1 is the
  // smallest/reddest band (the core). Rendered in this order so smaller,
  // more-central bands paint on top of larger ones - that's what makes the
  // stack read as a smooth radial gradient instead of one flat color.
  const bands = Array.from({ length: BAND_COUNT }, (_, i) => {
    const t = i / (BAND_COUNT - 1); // 0 at edge -> 1 at core
    const radius = outerRadius * (0.12 + 0.88 * (1 - t));
    const bandColor = severityToColor(score * t);
    const fillOpacity = 0.06 + 0.55 * Math.pow(t, 1.6);
    return { t, radius, bandColor, fillOpacity };
  });

  return (
    <>
      {bands.map((band) => (
        <Circle
          key={band.t}
          center={position}
          radius={band.radius}
          pathOptions={{
            stroke: false,
            fillColor: band.bandColor,
            fillOpacity: band.fillOpacity,
            interactive: false,
          }}
        />
      ))}

      {/* Solid center dot + the interactive hit area covering the whole zone */}
      <Circle center={position} radius={outerRadius} pane={RISK_RING_HIT_PANE} pathOptions={{ opacity: 0, fillOpacity: 0 }}>
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95} sticky>
          {tooltipContent}
        </Tooltip>
        <Popup>{popupContent}</Popup>
      </Circle>
      <CircleMarker
        center={position}
        radius={6}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
          interactive: false,
        }}
      />
    </>
  );
}

export default RiskRings;
