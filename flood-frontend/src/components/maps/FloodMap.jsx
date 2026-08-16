import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, LayersControl, LayerGroup, Pane } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtGeojson from "../../data/sriLankaDistricts.json";
import { getLatestPrediction } from "../../services/predictionService";
import { getLatestRiver } from "../../services/riverService";
import { getLatestWeather } from "../../services/weatherService";
import RiskRings, { RISK_RING_HIT_PANE } from "./RiskRings";
import { RISK_LEVELS, RISK_COLORS, RISK_LABELS, normalizeRisk } from "../../utils/riskLevels";
import { computeStationSeverity } from "../../utils/floodSeverity";

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
//
// Covers every district referenced by backend/config.py's CITIES list, plus
// every river seen in the DMC river reports (see extracted_data/*.csv) -
// e.g. a real report row is "Kelani Ganga, Hanwella, 2.59, ...", so the
// river name always carries a "Ganga"/"Oya" suffix word; matching is done
// on just the first word (see riverKeyFor below).
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
  Ampara: [7.2975, 81.6747],
  Puttalam: [8.0362, 79.8283],
  Matale: [7.4675, 80.6234],
  Mannar: [8.9810, 79.9044],
  "Nuwara Eliya": [6.9497, 80.7891],
  Hambantota: [6.1246, 81.1185],
};

// Maps every city in backend/config.py's CITIES list to the district whose
// coordinates should represent it on the map (and whose polygon it should
// influence in districtRiskMap).
const cityToDistrict = {
  Colombo: "Colombo",
  "Mount Lavinia": "Colombo",
  Kesbewa: "Colombo",
  Moratuwa: "Colombo",
  Maharagama: "Colombo",
  Ratnapura: "Ratnapura",
  Kandy: "Kandy",
  Negombo: "Gampaha",
  "Sri Jayewardenepura Kotte": "Colombo",
  Kalmunai: "Ampara",
  Trincomalee: "Trincomalee",
  Galle: "Galle",
  Jaffna: "Jaffna",
  Athurugiriya: "Colombo",
  Weligama: "Matara",
  Matara: "Matara",
  Kolonnawa: "Colombo",
  Gampaha: "Gampaha",
  Puttalam: "Puttalam",
  Badulla: "Badulla",
  Kalutara: "Kalutara",
  Bentota: "Galle",
  Matale: "Matale",
  Mannar: "Mannar",
  Pothuhera: "Kurunegala",
  Kurunegala: "Kurunegala",
  Mabole: "Gampaha",
  Hatton: "Nuwara Eliya",
  Hambantota: "Hambantota",
  Oruwala: "Colombo",
};

// First word of the "River" field (see backend/extract_river_data.py, which
// takes the first two words of each parsed report line) -> approximate
// coordinates for that river.
const riverCoordinates = {
  Kelani: [6.95, 79.87],
  Kalu: [6.68, 80.39],
  Mahaweli: [7.30, 80.60],
  Nilwala: [6.00, 80.50],
  Deduru: [7.50, 80.20],
  Gurugoda: [7.05, 80.28],
  Seethawaka: [6.93, 80.21],
  Kehelgamu: [6.95, 80.62],
  Maguru: [6.62, 80.48],
  Gin: [6.05, 80.25],
  Urubokka: [6.35, 80.55],
  Walawe: [6.35, 80.85],
  Kirindi: [6.30, 81.20],
  Kuda: [6.60, 81.20],
  Menik: [6.40, 81.33],
  Kumbukkan: [6.70, 81.60],
  Heda: [6.90, 81.70],
  Maduru: [7.50, 81.40],
  Badulu: [6.99, 81.05],
  Yan: [8.60, 80.90],
  Maa: [7.30, 80.10],
  Malwathu: [8.65, 80.30],
  Mee: [7.70, 80.10],
  Maha: [7.30, 80.05],
  Attanagalu: [7.10, 80.10],
};

const riverKeyFor = (riverName) => (riverName || "").trim().split(/\s+/)[0];

const districtStyle = (feature, districtRisk = "Low") => ({
  color: "#334155",
  weight: 1,
  fillColor: RISK_COLORS[districtRisk] || RISK_COLORS.Low,
  fillOpacity: 0.4,
});

const districtPopup = (feature, districtRisk = "Low") => `
  <div>
    <strong>${feature?.properties?.name || "District"}</strong><br />
    ML flood-risk prediction (next day): ${RISK_LABELS[districtRisk] || districtRisk}
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
                const coords = riverCoordinates[riverKeyFor(riverName)];
                if (!coords) {
                  omitted += 1;
                  return null;
                }
                return {
                  ...item,
                  stationName: item.Station || riverName,
                  position: coords,
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

  // Multiple real gauge stations on the same river (e.g. Kelani Ganga has
  // separate Nagalagam Street/Hanwella/Glencourse/Kithulgala readings) share
  // one approximate river-level coordinate, since precise per-gauge lat/lng
  // isn't available anywhere in the system. Their zones end up stacked at
  // the same point, so render lowest severity first / highest severity last
  // - the most urgent reading at a shared point should always be the one
  // that's visually on top, not whichever happened to come first in the API
  // response.
  const riverStationsBySeverity = useMemo(() => {
    return riverStations
      .map((station) => ({ station, severity: computeStationSeverity(station) }))
      .sort((a, b) => a.severity.score - b.severity.score);
  }, [riverStations]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">Sri Lanka flood monitoring map</h3>
          <p className="text-sm text-slate-500">
            Observed river/weather conditions (DMC gauge data, live weather readings) alongside the ML model's
            next-day flood-risk prediction — the district shading and "ML flood-risk prediction" markers are
            forecasts, everything else on this map is an observed reading.
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
            <LayersControl.Overlay checked name="Observed weather">
              <LayerGroup>
                {weatherStations.map((station, index) => (
                  <Marker key={`${station.City}-${index}`} position={station.position}>
                    <Popup>
                      <strong>{station.City}</strong> — observed condition
                      <br />
                      Rainfall: {station.Rainfall} mm
                      <br />
                      Temperature: {station.Temperature} °C
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="ML flood-risk prediction">
              <LayerGroup>
                {predictionStations.map((station, index) => (
                  <Marker key={`${station.City}-${index}`} position={station.position}>
                    <Popup>
                      <strong>{station.City}</strong> — ML prediction, not an observed condition
                      <br />
                      ML predicted risk: {station.Predicted_Risk}
                      <br />
                      Rainfall (3-day): {station.Rainfall_3Day} mm
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Observed river stations">
              <LayerGroup>
                {riverStationsBySeverity.map(({ station, severity }, index) => (
                  <RiskRings
                    key={`${station.River}-${station.stationName}-${index}`}
                    position={station.position}
                    station={station}
                    tooltipContent={
                      <span className="text-xs font-medium text-slate-700">
                        {station.stationName} — {severity.category} ({Math.round(severity.score * 100)}%)
                      </span>
                    }
                    popupContent={
                      <div className="min-w-[200px] space-y-1 text-sm">
                        <div className="font-semibold text-slate-800">{station.stationName}</div>
                        <div className="text-slate-500">{station.River} river — observed DMC gauge reading</div>
                        <div>
                          Water level: <strong>{station.WaterLevel ?? "N/A"} m</strong>
                        </div>
                        <div>
                          Rainfall: <strong>{station.Rainfall ?? "N/A"} mm</strong>
                        </div>
                        <div className="text-slate-500">Observed status: {station.Status || "N/A"}</div>
                        <div className="pt-1">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white"
                            style={{ backgroundColor: severity.color }}
                          >
                            {severity.category} risk · {Math.round(severity.score * 100)}%
                          </span>
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
          Each river station's zone is a live severity score computed from its water level, rate of rise, rainfall and current
          RiverRisk classification — not a fixed color. The zone glows red at the station and fades smoothly through orange and
          yellow to green with distance, so impact spreads outward the way it would in a real flood: bigger, redder zones for
          stations that are rising fastest or already critical, small green ones for calm stations. Zones shrink back toward
          green automatically as conditions improve.
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
