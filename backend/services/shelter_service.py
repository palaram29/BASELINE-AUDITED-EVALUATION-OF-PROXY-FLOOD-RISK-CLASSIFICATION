"""Operator-managed flood shelters, and nearest-shelter lookup for the
citizen app's safety page.

There is no road-network data anywhere in this system, so this
deliberately does NOT attempt turn-by-turn routing or "avoid flooded
roads" logic - that would require a road graph and live road-level flood
status this project doesn't have, and guessing at either would risk
sending someone down a bad route. Instead: rank active shelters by real
straight-line distance, attach each shelter's own city's current
flood-risk forecast so the citizen can make an informed choice, and hand
off the actual turn-by-turn navigation to Google Maps, which already does
real road routing well.
"""

import math

from sqlalchemy import text

from database.db_connection import get_engine, ensure_shelters_table
from backend.services import alert_service

engine = get_engine()
ensure_shelters_table()

_UPDATABLE_FIELDS = {
    "name",
    "type",
    "latitude",
    "longitude",
    "city",
    "capacity",
    "contact_phone",
    "is_active",
}


def _row_to_shelter(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "city": row["city"],
        "capacity": row["capacity"],
        "contact_phone": row["contact_phone"],
        "is_active": row["is_active"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def list_shelters():
    """Every shelter, active or not - the operator console needs both to
    let a retired shelter be reactivated."""

    with engine.connect() as conn:
        rows = conn.execute(
            text('SELECT * FROM shelters ORDER BY created_at DESC')
        ).mappings().all()

    return [_row_to_shelter(row) for row in rows]


def create_shelter(data):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO shelters
                    (name, type, latitude, longitude, city, capacity, contact_phone, is_active)
                VALUES
                    (:name, :type, :latitude, :longitude, :city, :capacity, :contact_phone, :is_active)
                RETURNING *
                """
            ),
            data,
        ).mappings().first()

    return _row_to_shelter(row)


def update_shelter(shelter_id, data):
    """Partial update - only fields present in `data` are changed.
    Returns None if no shelter has that id."""

    fields = {key: value for key, value in data.items() if key in _UPDATABLE_FIELDS}

    if not fields:
        with engine.connect() as conn:
            row = conn.execute(
                text('SELECT * FROM shelters WHERE id = :id'), {"id": shelter_id}
            ).mappings().first()
        return _row_to_shelter(row) if row else None

    set_clause = ", ".join(f"{key} = :{key}" for key in fields)
    fields["id"] = shelter_id

    with engine.begin() as conn:
        row = conn.execute(
            text(f"UPDATE shelters SET {set_clause}, updated_at = NOW() WHERE id = :id RETURNING *"),
            fields,
        ).mappings().first()

    return _row_to_shelter(row) if row else None


def delete_shelter(shelter_id):
    with engine.begin() as conn:
        result = conn.execute(text('DELETE FROM shelters WHERE id = :id'), {"id": shelter_id})

    return result.rowcount > 0


def _haversine_km(lat1, lon1, lat2, lon2):
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


def _maps_url(origin_lat, origin_lon, dest_lat, dest_lon):
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin_lat},{origin_lon}"
        f"&destination={dest_lat},{dest_lon}"
        "&travelmode=driving"
    )


def nearest_shelters(lat, lon, limit=5):
    """Active shelters ranked by real straight-line distance from
    (lat, lon), each annotated with its own city's current flood-risk
    forecast (so a citizen can see, e.g., that the closest shelter sits in
    a city currently under a High alert and choose accordingly) and a
    ready-to-open Google Maps directions link.

    Distance is straight-line, not road distance - this is a ranking
    signal to shortlist candidates, not a routing engine. The actual
    driving/walking route comes from the Maps link, which does real road
    routing."""

    with engine.connect() as conn:
        rows = conn.execute(
            text('SELECT * FROM shelters WHERE is_active = TRUE')
        ).mappings().all()

    risk_by_city = {}
    results = []

    for row in rows:
        shelter = _row_to_shelter(row)
        city = shelter["city"]

        if city not in risk_by_city:
            risk_by_city[city] = alert_service.get_alert_for_city(city)
        alert = risk_by_city[city]

        shelter["distance_km"] = round(_haversine_km(lat, lon, shelter["latitude"], shelter["longitude"]), 2)
        shelter["city_risk_level"] = alert["risk_level"] if alert["has_data"] else None
        shelter["city_risk_label"] = alert["risk_label"] if alert["has_data"] else None
        shelter["maps_url"] = _maps_url(lat, lon, shelter["latitude"], shelter["longitude"])

        results.append(shelter)

    results.sort(key=lambda item: item["distance_km"])

    return results[:limit]
