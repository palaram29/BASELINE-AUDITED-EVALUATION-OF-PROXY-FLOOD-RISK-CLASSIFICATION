import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import districtGeojson from "../../data/sriLankaDistricts.json";
import { getLatestPrediction } from "../../services/predictionService";
import { getLatestRiver } from "../../services/riverService";
import { getLatestWeather } from "../../services/weatherService";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const riskColors = {
  Low: "#22c55e",
  Moderate: "#f59e0b",
  High: "#ef4444",
  Severe: "#b91c1c",
};

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

const normalizeName = (value) => (value || "").toString().trim().toLowerCase();

const districtStyle = (feature, districtRisk = "Low") => ({
  color: "#334155",
  weight: 1,
  fillColor: riskColors[districtRisk] || riskColors.Low,
  fillOpacity: 0.45,
});

const districtPopup = (feature, districtRisk = "Low") => `
  <div>
    <strong>${feature?.properties?.name || "District"}</strong><br />
    Flood risk: ${districtRisk}
  </div>
`;

function FloodMap() {
  const [riverStations, setRiverStations] = useState([]);
  const [weatherStations, setWeatherStations] = useState([]);
  const [predictionStations, setPredictionStations] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mapRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMapData = async () => {
      try {
        setLoading(true);
        setError("");

        const [predictionResponse, riverResponse, weatherResponse] = await Promise.all([
          getLatestPrediction(),
          getLatestRiver(),
          getLatestWeather(),
        ]);

        console.log("Prediction API response:", predictionResponse);
        console.log("River API response:", riverResponse);
        console.log("Weather API response:", weatherResponse);

        const mappedPredictions = Array.isArray(predictionResponse)
          ? predictionResponse.map((item) => {
              const cityName = item.City || "";
              const districtName = cityToDistrict[cityName] || cityName;
              const coords = districtCoordinates[districtName] || [7.5, 80.7];

              return {
                ...item,
                districtName,
                position: coords,
              };
            })
          : [];

        const mappedRiverStations = Array.isArray(riverResponse)
          ? riverResponse.map((item) => {
              const riverName = item.River || "";
              const stationName = item.Station || "";
              const coords = riverCoordinates[riverName] || [7.5, 80.7];

              return {
                ...item,
                stationName,
                position: coords,
              };
            })
          : [];

        const mappedWeatherStations = Array.isArray(weatherResponse)
          ? weatherResponse.map((item) => {
              const cityName = item.City || "";
              const districtName = cityToDistrict[cityName] || cityName;
              const coords = districtCoordinates[districtName] || [7.5, 80.7];

              return {
                ...item,
                districtName,
                position: coords,
              };
            })
          : [];

        console.log("Mapped prediction markers:", mappedPredictions);
        console.log("Mapped river markers:", mappedRiverStations);
        console.log("Mapped weather markers:", mappedWeatherStations);

        if (isMounted) {
          setPredictionStations(mappedPredictions);
          setRiverStations(mappedRiverStations);
          setWeatherStations(mappedWeatherStations);
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

    return () => {
      isMounted = false;
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
        const normalizedRisk = normalizeName(station.Predicted_Risk || "Low");
        const risk = normalizedRisk.includes("high") ? "High" : normalizedRisk.includes("moderate") ? "Moderate" : "Low";
        riskByDistrict[station.districtName] = risk;
      }
    });

    return riskByDistrict;
  }, [predictionStations]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">Sri Lanka flood monitoring map</h3>
          <p className="text-sm text-slate-500">Interactive district risk view with river and weather monitoring stations.</p>
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

      <div className="h-[560px] w-full overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer
          center={[7.5, 80.7]}
          zoom={7}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name="Flood Risk">
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
            <LayersControl.Overlay checked name="Rivers">
              {riverStations.map((station, index) => (
                <Marker key={`${station.River}-${station.Station}-${index}`} position={station.position}>
                  <Popup>
                    <strong>{station.River}</strong>
                    <br />
                    {station.Station}
                    <br />
                    Water level: {station.WaterLevel} m
                    <br />
                    Status: {station.Status}
                  </Popup>
                </Marker>
              ))}
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Weather">
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
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Predictions">
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
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <div className="rounded-full bg-green-50 px-3 py-1">Green — Low risk</div>
        <div className="rounded-full bg-yellow-50 px-3 py-1">Yellow — Moderate risk</div>
        <div className="rounded-full bg-orange-50 px-3 py-1">Orange — High risk</div>
        <div className="rounded-full bg-red-50 px-3 py-1">Red — Severe risk</div>
      </div>
    </div>
  );
}

export default FloodMap;
