import { useState } from "react";
import { FiMapPin, FiCrosshair } from "react-icons/fi";
import { nearestCity } from "../utils/cityCoords";

/**
 * City selector for the 30 monitored cities, plus a "use my location"
 * button that resolves the browser's GPS position to the nearest
 * monitored city. `value` / `onChange` are the selected city name.
 */
function LocationPicker({ cities, value, onChange, id = "location" }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const useMyLocation = () => {
    setGeoError("");
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser can't share a location. Please pick a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const match = nearestCity(
          position.coords.latitude,
          position.coords.longitude,
          cities
        );
        setLocating(false);
        if (match) {
          onChange(match);
        } else {
          setGeoError("Couldn't match your location to a monitored city. Please pick one.");
        }
      },
      () => {
        setLocating(false);
        setGeoError("We couldn't get your location. Please pick a city instead.");
      },
      { timeout: 10000 }
    );
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        Your area
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <FiMapPin
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <select
            id={id}
            required
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Select your city
            </option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <FiCrosshair className="h-4 w-4" aria-hidden="true" />
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Alerts use the nearest monitored city. We store only the city name, not your exact location.
      </p>
      {geoError ? <p className="mt-1 text-xs text-red-600">{geoError}</p> : null}
    </div>
  );
}

export default LocationPicker;
