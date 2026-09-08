import { useState } from "react";
import { FiCrosshair, FiNavigation, FiPhone, FiUsers } from "react-icons/fi";
import Card from "./common/Card";
import Spinner from "./common/Spinner";
import ErrorMessage from "./common/ErrorMessage";
import { getNearestShelters } from "../services/dataService";
import { riskTheme, riskLabel } from "../utils/risk";
import { CITY_COORDS } from "../utils/cityCoords";

const TYPE_LABEL = {
  school: "School",
  temple: "Temple / religious site",
  community_hall: "Community hall",
  government_building: "Government building",
  other: "Shelter",
};

/**
 * Finds the nearest active shelters to the citizen's location. There's no
 * road-network data in this system, so this doesn't attempt turn-by-turn
 * "avoid flooded roads" routing - it ranks shelters by straight-line
 * distance, shows each one's own city's current flood-risk forecast so
 * the citizen can judge for themselves, and hands off real navigation to
 * Google Maps (the "Get directions" link), which already does real road
 * routing well.
 */
function ShelterFinder({ homeCity }) {
  const [status, setStatus] = useState("idle"); // idle | locating | done | error
  const [shelters, setShelters] = useState(null);
  const [error, setError] = useState("");

  const search = (lat, lon) => {
    getNearestShelters(lat, lon)
      .then((data) => {
        setShelters(Array.isArray(data) ? data : []);
        setStatus("done");
      })
      .catch(() => {
        setError("Couldn't load shelters. Please try again.");
        setStatus("error");
      });
  };

  const findNearMe = () => {
    setError("");
    setStatus("locating");
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share a location.");
      setStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => search(position.coords.latitude, position.coords.longitude),
      () => {
        setError("We couldn't get your location. Please allow location access and try again.");
        setStatus("error");
      },
      { timeout: 10000 }
    );
  };

  const useRegisteredArea = () => {
    const coords = homeCity && CITY_COORDS[homeCity];
    if (!coords) return;
    setError("");
    setStatus("locating");
    search(coords[0], coords[1]);
  };

  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Find your nearest shelter
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Shows the closest designated shelters, ranked by distance, with a link for real
        driving/walking directions.
      </p>

      {status !== "done" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={findNearMe}
            disabled={status === "locating"}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiCrosshair className="h-4 w-4" aria-hidden="true" />
            {status === "locating" ? "Locating…" : "Use my location"}
          </button>
          {homeCity && CITY_COORDS[homeCity] ? (
            <button
              type="button"
              onClick={useRegisteredArea}
              disabled={status === "locating"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use {homeCity} instead
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "locating" ? <Spinner label="Finding nearby shelters…" /> : null}
      {status === "error" ? <div className="mt-3"><ErrorMessage message={error} onRetry={findNearMe} /></div> : null}

      {status === "done" ? (
        shelters.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No shelters have been registered for your area yet. Call the Disaster Management
            Centre (117) for the nearest official evacuation point.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {shelters.map((shelter) => {
              const theme = shelter.city_risk_level ? riskTheme(shelter.city_risk_level) : null;
              return (
                <li key={shelter.id} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{shelter.name}</p>
                      <p className="text-xs text-slate-500">
                        {TYPE_LABEL[shelter.type] || shelter.type} · {shelter.city} ·{" "}
                        {shelter.distance_km} km away
                      </p>
                    </div>
                    {theme ? (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.badge}`}>
                        {riskLabel(shelter.city_risk_level)} risk
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {shelter.capacity ? (
                      <span className="flex items-center gap-1">
                        <FiUsers className="h-3.5 w-3.5" aria-hidden="true" />
                        Capacity {shelter.capacity}
                      </span>
                    ) : null}
                    {shelter.contact_phone ? (
                      <a href={`tel:${shelter.contact_phone}`} className="flex items-center gap-1 hover:underline">
                        <FiPhone className="h-3.5 w-3.5" aria-hidden="true" />
                        {shelter.contact_phone}
                      </a>
                    ) : null}
                  </div>

                  <a
                    href={shelter.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                  >
                    <FiNavigation className="h-3.5 w-3.5" aria-hidden="true" />
                    Get directions
                  </a>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </Card>
  );
}

export default ShelterFinder;
