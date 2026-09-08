import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SRI_LANKA_CENTER = [7.5, 80.7];

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Click-to-place-pin location input for the shelter form. There's no
 * address geocoding anywhere in this system, so a physical shelter's
 * coordinates are set by clicking where it actually is on the map, not by
 * typing an address.
 */
function ShelterLocationPicker({ latitude, longitude, onChange }) {
  const hasPosition = latitude != null && longitude != null;
  const position = hasPosition ? [latitude, longitude] : null;

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong">
      <div className="h-64 w-full">
        <MapContainer
          center={position || SRI_LANKA_CENTER}
          zoom={position ? 13 : 7}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          {position ? <Marker position={position} /> : null}
        </MapContainer>
      </div>
      <p className="border-t border-line bg-surface-2 px-3 py-1.5 text-xs text-muted">
        Click the map where this shelter is located.
        {hasPosition ? ` Selected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : " No location set yet."}
      </p>
    </div>
  );
}

export default ShelterLocationPicker;
