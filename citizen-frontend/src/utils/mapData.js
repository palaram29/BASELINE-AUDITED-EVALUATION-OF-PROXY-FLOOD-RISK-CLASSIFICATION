// Lookups for the risk map. Kept in step with the operator app's
// flood-frontend/src/components/maps/FloodMap.jsx (same city->district
// map and river coordinates) so both maps place things identically.
import { normalizeRisk, riskRank } from "./risk";

// Every monitored city (backend/config.py CITIES) -> the district polygon
// in sriLankaDistricts.json whose shading it should influence. Cities in
// districts we have no polygon for still get their own marker.
export const CITY_TO_DISTRICT = {
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

// First word of the DMC "River" field -> approximate coordinates for that
// river. Stations on rivers not listed here are left off the map.
export const RIVER_COORDS = {
  Kelani: [6.95, 79.87],
  Kalu: [6.68, 80.39],
  Mahaweli: [7.3, 80.6],
  Nilwala: [6.0, 80.5],
  Deduru: [7.5, 80.2],
  Gurugoda: [7.05, 80.28],
  Seethawaka: [6.93, 80.21],
  Kehelgamu: [6.95, 80.62],
  Maguru: [6.62, 80.48],
  Gin: [6.05, 80.25],
  Urubokka: [6.35, 80.55],
  Walawe: [6.35, 80.85],
  Kirindi: [6.3, 81.2],
  Kuda: [6.6, 81.2],
  Menik: [6.4, 81.33],
  Kumbukkan: [6.7, 81.6],
  Heda: [6.9, 81.7],
  Maduru: [7.5, 81.4],
  Badulu: [6.99, 81.05],
  Yan: [8.6, 80.9],
  Maa: [7.3, 80.1],
  Malwathu: [8.65, 80.3],
  Mee: [7.7, 80.1],
  Maha: [7.3, 80.05],
  Attanagalu: [7.1, 80.1],
};

export const riverKeyFor = (riverName) => (riverName || "").trim().split(/\s+/)[0];

// Highest predicted risk among the monitored cities that sit in each
// district, so a district polygon is shaded by the worst forecast inside
// it (matching how a resident would read the map).
export function districtRiskMap(predictions = []) {
  const byDistrict = {};
  for (const row of predictions) {
    const district = CITY_TO_DISTRICT[row.City];
    if (!district) continue;
    const risk = normalizeRisk(row.Predicted_Risk);
    if (!(district in byDistrict) || riskRank(risk) > riskRank(byDistrict[district])) {
      byDistrict[district] = risk;
    }
  }
  return byDistrict;
}
