// Approximate coordinates for every monitored city (backend/config.py's
// CITIES list). Used only to resolve the browser's geolocation to the
// nearest monitored city on the Register / Account screens - the backend
// still keys everything off the city *name*, so approximate points are
// fine. Cities not in this map simply can't be auto-picked.
export const CITY_COORDS = {
  Colombo: [6.9271, 79.8612],
  "Mount Lavinia": [6.8389, 79.8653],
  Kesbewa: [6.7954, 79.9407],
  Moratuwa: [6.773, 79.8816],
  Maharagama: [6.848, 79.9265],
  Ratnapura: [6.6828, 80.3992],
  Kandy: [7.2906, 80.6337],
  Negombo: [7.2083, 79.8358],
  "Sri Jayewardenepura Kotte": [6.888, 79.9186],
  Kalmunai: [7.4098, 81.8344],
  Trincomalee: [8.5874, 81.2152],
  Galle: [6.0535, 80.221],
  Jaffna: [9.6615, 80.0255],
  Athurugiriya: [6.8756, 79.9915],
  Weligama: [5.9749, 80.4297],
  Matara: [5.9485, 80.5353],
  Kolonnawa: [6.933, 79.889],
  Gampaha: [7.0917, 79.9997],
  Puttalam: [8.0362, 79.8283],
  Badulla: [6.9934, 81.055],
  Kalutara: [6.5854, 79.9607],
  Bentota: [6.4258, 79.9959],
  Matale: [7.4675, 80.6234],
  Mannar: [8.981, 79.9044],
  Pothuhera: [7.3833, 80.3333],
  Kurunegala: [7.4863, 80.3647],
  Mabole: [7.0, 79.9],
  Hatton: [6.8913, 80.5959],
  Hambantota: [6.1246, 81.1185],
  Oruwala: [6.89, 79.96],
};

// Haversine-free rough distance (equirectangular) - accurate enough for
// picking the closest point within one small country.
function roughDistance([lat1, lon1], [lat2, lon2]) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y);
}

// Returns the name of the monitored city closest to the given
// coordinates, restricted to `allowedCities` when provided.
export function nearestCity(lat, lon, allowedCities) {
  const allow = allowedCities && allowedCities.length ? new Set(allowedCities) : null;
  let best = null;
  let bestDist = Infinity;

  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (allow && !allow.has(city)) continue;
    const dist = roughDistance([lat, lon], coords);
    if (dist < bestDist) {
      bestDist = dist;
      best = city;
    }
  }
  return best;
}
