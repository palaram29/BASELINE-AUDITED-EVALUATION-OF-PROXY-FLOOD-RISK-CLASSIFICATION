import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  LayersControl,
  LayerGroup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import districtGeojson from "../data/sriLankaDistricts.json";
import { normalizeRisk, riskLabel, riskHex } from "../utils/risk";
import { FLOOD_LEVELS, formatLevel } from "../utils/riverLevels";
import { CITY_COORDS } from "../utils/cityCoords";
import { RIVER_COORDS, riverKeyFor, districtRiskMap } from "../utils/mapData";

// Everything Leaflet lives in this module so it (and the ~140 KB of
// leaflet + react-leaflet + CSS) is code-split into an async chunk that
// only downloads when a visitor opens the Map tab. See MapPage.jsx.

const SRI_LANKA_CENTER = [7.9, 80.7];

const RIVER_STATUS_HEX = {
  Normal: "#16a34a",
  Alert: "#d97706",
  "Minor Flood": "#ea580c",
  "Major Flood": "#dc2626",
};

const youAreHereIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;' +
    'border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.30)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const shelterIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:22px;height:22px;border-radius:9999px;background:#16a34a;' +
    'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);' +
    'display:flex;align-items:center;justify-content:center;font-size:12px;">🏠</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const shelterMapsUrl = (lat, lon) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

// Recenters the map when the target coordinate changes (e.g. the user
// grants location, or their saved area loads).
function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.6 });
  }, [map, center, zoom]);
  return null;
}

function districtStyle(risk) {
  return {
    color: "#475569",
    weight: 1,
    fillColor: riskHex(risk),
    fillOpacity: risk === "Low" ? 0.12 : 0.28,
  };
}

function RiskMap({ predictions = [], rivers = [], shelters = [], myLocation = null, homeCity = null }) {
  const activeShelters = shelters.filter(
    (shelter) => shelter.is_active && shelter.latitude != null && shelter.longitude != null
  );

  const districtRisk = districtRiskMap(predictions);

  const cityPoints = predictions
    .map((row) => {
      const coords = CITY_COORDS[row.City];
      if (!coords) return null;
      return { ...row, coords, risk: normalizeRisk(row.Predicted_Risk) };
    })
    .filter(Boolean);

  const riverPoints = rivers
    .map((row, index) => {
      const coords = RIVER_COORDS[riverKeyFor(row.River)];
      if (!coords) return null;
      return { ...row, coords, id: `${row.River}-${row.Station}-${index}` };
    })
    .filter(Boolean);

  const initialCenter = myLocation || (homeCity && CITY_COORDS[homeCity]) || SRI_LANKA_CENTER;
  const initialZoom = myLocation || homeCity ? 9 : 7;

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <Recenter center={myLocation || (homeCity && CITY_COORDS[homeCity]) || null} zoom={9} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <LayersControl position="topright">
        <LayersControl.Overlay checked name="District risk (tomorrow)">
          <GeoJSON
            key={JSON.stringify(districtRisk)}
            data={districtGeojson}
            style={(feature) => districtStyle(districtRisk[feature?.properties?.name] || "Low")}
            onEachFeature={(feature, layer) => {
              const name = feature?.properties?.name || "District";
              const risk = districtRisk[name] || "Low";
              layer.bindPopup(
                `<strong>${name} district</strong><br/>Forecast flood risk tomorrow: ${riskLabel(risk)}`
              );
            }}
          />
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Area forecast">
          <LayerGroup>
            {cityPoints.map((city) => {
              const isHome = homeCity && city.City === homeCity;
              return (
                <CircleMarker
                  key={city.City}
                  center={city.coords}
                  radius={isHome ? 9 : 7}
                  pathOptions={{
                    color: isHome ? "#1d4ed8" : "#ffffff",
                    weight: isHome ? 3 : 1.5,
                    fillColor: riskHex(city.risk),
                    fillOpacity: 0.9,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    {city.City}: {riskLabel(city.risk)}
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{city.City}</strong>
                      {isHome ? " — your area" : ""}
                      <br />
                      Forecast tomorrow: <strong>{riskLabel(city.risk)}</strong>
                      {city.Rainfall_3Day != null ? (
                        <>
                          <br />
                          {city.Rainfall_3Day} mm rain in the 3-day forecast
                        </>
                      ) : null}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="River gauges (now)">
          <LayerGroup>
            {riverPoints.map((station) => (
              <CircleMarker
                key={station.id}
                center={station.coords}
                radius={5}
                pathOptions={{
                  color: RIVER_STATUS_HEX[station.Status] || "#64748b",
                  weight: 3,
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  {station.Station} — {formatLevel(station.WaterLevel)}
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{station.Station}</strong>
                    <br />
                    {station.River} river — {station.Status || "reading"}
                    <br />
                    Water level: <strong>{formatLevel(station.WaterLevel)}</strong>
                    {FLOOD_LEVELS.map((level) => (
                      <span key={level.key}>
                        <br />
                        {level.label}: {formatLevel(station[level.key])}
                      </span>
                    ))}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Flood shelters">
          <LayerGroup>
            {activeShelters.map((shelter) => (
              <Marker key={shelter.id} position={[shelter.latitude, shelter.longitude]} icon={shelterIcon}>
                <Tooltip direction="top" offset={[0, -10]}>
                  {shelter.name}
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{shelter.name}</strong>
                    <br />
                    {shelter.city}
                    {shelter.capacity ? (
                      <>
                        <br />
                        Capacity: {shelter.capacity}
                      </>
                    ) : null}
                    {shelter.contact_phone ? (
                      <>
                        <br />
                        {shelter.contact_phone}
                      </>
                    ) : null}
                    <br />
                    <a
                      href={shelterMapsUrl(shelter.latitude, shelter.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>

      {myLocation ? (
        <Marker position={myLocation} icon={youAreHereIcon}>
          <Popup>You are here</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}

export default RiskMap;
