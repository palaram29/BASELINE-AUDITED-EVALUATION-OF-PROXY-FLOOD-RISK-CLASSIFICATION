import { useState } from "react";
import { FiCrosshair, FiMapPin } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useLiveData from "../hooks/useLiveData";
import { getLatestPrediction, getLatestRiver } from "../services/dataService";
import Card from "../components/common/Card";
import ErrorMessage from "../components/common/ErrorMessage";
import DataFreshness from "../components/common/DataFreshness";
import LazyRiskMap from "../components/LazyRiskMap";
import { RISK_ORDER, RISK_HEX, riskLabel } from "../utils/risk";

function MapPage() {
  const { user } = useAuth();
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const {
    data: predictions,
    error: predError,
    lastUpdated,
    refresh: refreshPred,
  } = useLiveData(getLatestPrediction, { intervalMs: 60000, initial: [] });
  const { data: rivers, error: riverError } = useLiveData(getLatestRiver, {
    intervalMs: 60000,
    initial: [],
  });

  const showMyLocation = () => {
    setGeoError("");
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser can't share a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setMyLocation([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        setLocating(false);
        setGeoError("We couldn't get your location. Check your browser's location permission.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Flood risk map</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tomorrow's forecast by area, and current river gauge readings across Sri Lanka.
          </p>
        </div>
        <button
          type="button"
          onClick={showMyLocation}
          disabled={locating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <FiCrosshair className="h-4 w-4" aria-hidden="true" />
          {locating ? "Locating…" : "Show my location"}
        </button>
      </div>

      {geoError ? <p className="text-xs text-red-600">{geoError}</p> : null}
      {predError && riverError ? (
        <ErrorMessage message="We couldn't load the map data." onRetry={refreshPred} />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="h-[60vh] min-h-[380px] w-full">
          <LazyRiskMap
            eager
            predictions={predictions || []}
            rivers={rivers || []}
            myLocation={myLocation}
            homeCity={user?.alert_city || null}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Forecast:</span>
          {RISK_ORDER.map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border border-white ring-1 ring-slate-200"
                style={{ backgroundColor: RISK_HEX[level] }}
              />
              {riskLabel(level)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-slate-500 bg-white" />
            River gauge
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-200" />
            You / your area
          </span>
        </div>
        <DataFreshness timestamp={lastUpdated} />
      </div>

      <Card>
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <FiMapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Coloured dots are the model's next-day flood-risk forecast for each monitored town.
          Ringed white dots are live river gauge readings from the Disaster Management Centre.
          District shading shows the highest forecast risk among towns in that district. This is a
          forecast, not an official warning.
        </p>
      </Card>
    </div>
  );
}

export default MapPage;
