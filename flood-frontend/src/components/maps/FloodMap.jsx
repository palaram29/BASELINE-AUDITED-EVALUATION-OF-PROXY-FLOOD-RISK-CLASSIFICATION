import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, LayersControl, LayerGroup, Pane } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtGeojson from "../../data/sriLankaDistricts.json";
import { getLatestPrediction } from "../../services/predictionService";
import { getLatestRiver } from "../../services/riverService";
import { getLatestWeather } from "../../services/weatherService";
import RiskRings, { RISK_RING_HIT_PANE } from "./RiskRings";
import Badge from "../common/Badge";
import { riskTone } from "../../utils/riskTone";
import { RISK_LEVELS, RISK_COLORS, RISK_LABELS, normalizeRisk, statusToRisk } from "../../utils/riskLevels";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Refresh live map data on an interval, matching useLiveDashboard's polling
// cadence, so the map reflects a new pipeline run without a page reload.
const REFRESH_INTERVAL_MS = 45000;

// Real, approximate coordinates for the named rivers/districts the backend
// reports on. Stations whose river or city isn't in these lookups are left
// off the map rather than plotted at a fallback point, so nothing is shown
// at a location we don't actually know.
const districtCoordinates = {
  Colombo: [6.9271, 79.8612],
  Gampaha: [7.0873, 79.9991],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Galle: [6.0535, 80.2210],
  Matara: [5.9549, 80.5550],
  Jaffna: [9.6615, 80.0255],
  Trincomalee: [8.5874, 81.2152],
  Ratnapura: [6.7056, 80.3847],
  Kurunegala: [7.4863, 80.3647],
  Anuradhapura: [8.3114, 80.4037],
  Badulla: [6.9898, 81.0550],
};

const cityToDistrict = {
  Colombo: "Colombo",
  Gampaha: "Gampaha",
  Kalutara: "Kalutara",
  Kandy: "Kandy",
  Galle: "Galle",
  Matara: "Matara",
  Jaffna: "Jaffna",
  Trincomalee: "Trincomalee",
  Ratnapura: "Ratnapura",
  Kurunegala: "Kurunegala",
  Anuradhapura: "Anuradhapura",
  Badulla: "Badulla",
};

const riverCoordinates = {
  Kelani: [6.95, 79.87],
  Kalu: [6.80, 80.40],
  Mahaweli: [7.30, 80.60],
  Nilwala: [6.00, 80.50],
  Deduru: [7.50, 80.20],
};

const districtStyle = (feature, districtRisk = "Low") => ({
  color: "#334155",
  weight: 1,
  fillColor: RISK_COLORS[districtRisk] || RISK_COLORS.Low,
  fillOpacity: 0.4,
});

const districtPopup = (feature, districtRisk = "Low") => `
  <div>
    <strong>${feature?.properties?.name || "District"}</strong><br />
    Flood risk: ${RISK_LABELS[districtRisk] || districtRisk}
  </div>
`;

function FloodMap() {
  const [riverStations, setRiverStations] = useState([]);
  const [weatherStations, setWeatherStations] = useState([]);
  const [predictionStations, setPredictionStations] = useState([]);
  const [omittedCount, setOmittedCount] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mapRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMapData = async () => {
      try {
        setError("");

        const [predictionResponse, riverResponse, weatherResponse] = await Promise.all([
          getLatestPrediction(),
          getLatestRiver(),
          getLatestWeather(),
        ]);

        let omitted = 0;

        const mappedPredictions = Array.isArray(predictionResponse)
          ? predictionResponse
              .map((item) => {
                const cityName = item.City || "";
                const districtName = cityToDistrict[cityName] || cityName;
                const coords = districtCoordinates[districtName];
                if (!coords) {
                  omitted += 1;
                  return null;
                }
                return { ...item, districtName, position: coords };
              })
              .filter(Boolean)
          : [];

        const mappedRiverStations = Array.isArray(riverResponse)
          ? riverResponse
              .map((item) => {
                const riverName = item.River || "";
                const coords = riverCoordinates[riverName];
                if (!coords) {
                  omitted += 1;
                  return null;
                }
                return {
                  ...item,
                  stationName: item.Station || riverName,
                  position: coords,
                  risk: item.RiverRisk || statusToRisk(item.Status),
                };
              })
              .filter(Boolean)
          : [];

        const mappedWeatherStations = Array.isArray(weatherResponse)
          ? weatherResponse
              .map((item) => {
                const cityName = item.City || "";
                const districtName = cityToDistrict[cityName] || cityName;
                const coords = districtCoordinates[districtName];
                if (!coords) {
                  omitted += 1;
                  return null;
                }
                return { ...item, districtName, position: coords };
              })
              .filter(Boolean)
          : [];

        if (isMounted) {
          setPredictionStations(mappedPredictions);
          setRiverStations(mappedRiverStations);
          setWeatherStations(mappedWeatherStations);
          setOmittedCount(omitted);
        }
      } catch (err) {
        console.error("Map data fetch failed:", err);
        if (isMounted) {
          setError("Unable to load map data from the API.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMapData();
    const interval = setInterval(fetchMapData, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedDistrict && mapRef.current) {
      const coords = districtCoordinates[selectedDistrict];
      if (coords) {
        mapRef.current.flyTo(coords, 9);
      }
    }
  }, [selectedDistrict]);

  const districtList = useMemo(() => districtGeojson.features.map((item) => item.properties.name), []);

  const districtRiskMap = useMemo(() => {
    const riskByDistrict = {};

    predictionStations.forEach((station) => {
      if (station.districtName) {
        riskByDistrict[station.districtName] = normalizeRisk(station.Predicted_Risk);
      }
    });

    return riskByDistrict;
  }, [predictionStations]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">Sri Lanka flood monitoring map</h3>
          <p className="text-sm text-slate-500">
            District risk view with river stations shown as flood-risk rings, plus weather and prediction markers.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Search district or city"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            list="district-options"
            onChange={(event) => {
              const value = event.target.value;
              const match = districtGeojson.features.find((item) => item.properties.name.toLowerCase() === value.toLowerCase());
              if (match) {
                setSelectedDistrict(match.properties.name);
              }
            }}
          />
          <datalist id="district-options">
            {districtList.map((name) => <option key={name} value={name} />)}
          </datalist>
        </div>
      </div>

      {loading ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Loading live map data...
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-[560px]">
        <MapContainer
          center={[7.5, 80.7]}
          zoom={7}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          {/* Dedicated pane, above markerPane, so river-station hit-circles
              stay clickable even when a weather/prediction pin sits nearby. */}
          <Pane name={RISK_RING_HIT_PANE} style={{ zIndex: 610 }} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name="District risk">
              <GeoJSON
                data={districtGeojson}
                style={(feature) => districtStyle(feature, districtRiskMap[feature?.properties?.name] || feature?.properties?.risk || "Low")}
                onEachFeature={(feature, layer) => {
                  const districtName = feature?.properties?.name || "District";
                  const districtRisk = districtRiskMap[districtName] || feature?.properties?.risk || "Low";
                  layer.bindPopup(districtPopup(feature, districtRisk));
                  layer.on({
                    mouseover: () => layer.setStyle({ weight: 2, fillOpacity: 0.7 }),
                    mouseout: () => layer.setStyle(districtStyle(feature, districtRisk)),
                  });
                }}
              />
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Weather">
              <LayerGroup>
                {weatherStations.map((station, index) => (
                  <Marker key={`${station.City}-${index}`} position={station.position}>
                    <Popup>
                      <strong>{station.City}</strong>
                      <br />
                      Rainfall: {station.Rainfall} mm
                      <br />
                      Temperature: {station.Temperature} °C
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Predictions">
              <LayerGroup>
                {predictionStations.map((station, index) => (
                  <Marker key={`${station.City}-${index}`} position={station.position}>
                    <Popup>
                      <strong>{station.City}</strong>
                      <br />
                      Risk: {station.Predicted_Risk}
                      <br />
                      Rainfall (3-day): {station.Rainfall_3Day} mm
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
            {/* Rendered last (and pinned to markerPane) so its hit-circles
                stack above any weather/prediction pin that lands nearby. */}
            <LayersControl.Overlay checked name="River risk stations">
              <LayerGroup>
                {riverStations.map((station, index) => (
                  <RiskRings
                    key={`${station.River}-${station.stationName}-${index}`}
                    position={station.position}
                    risk={station.risk}
                    tooltipContent={
                      <span className="text-xs font-medium text-slate-700">
                        {station.stationName} ({RISK_LABELS[normalizeRisk(station.risk)]})
                      </span>
                    }
                    popupContent={
                      <div className="min-w-[190px] space-y-1 text-sm">
                        <div className="font-semibold text-slate-800">{station.stationName}</div>
                        <div className="text-slate-500">{station.River} river</div>
                        <div>
                          Water level: <strong>{station.WaterLevel ?? "N/A"} m</strong>
                        </div>
                        <div>
                          Rainfall: <strong>{station.Rainfall ?? "N/A"} mm</strong>
                        </div>
                        <div className="text-slate-500">Status: {station.Status || "N/A"}</div>
                        <div className="pt-1">
                          <Badge tone={riskTone(normalizeRisk(station.risk))}>{RISK_LABELS[normalizeRisk(station.risk)]}</Badge>
                        </div>
                      </div>
                    }
                  />
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs text-slate-500">
          Rings radiate from each river station's real coordinates: the innermost ring is the current risk level, fading outward
          toward green (safe). Larger, redder rings mean higher risk.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 sm:flex sm:flex-wrap sm:gap-3">
          {RISK_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-2 rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
              {RISK_LABELS[level]}
            </div>
          ))}
        </div>
        {omittedCount > 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            {omittedCount} station{omittedCount === 1 ? "" : "s"} not shown — no mapped coordinates for that river/city yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default FloodMap;
