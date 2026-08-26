"""Read-only user-management data for the operator console.

flood-frontend/ has no login of its own (see docs/ML_METHODOLOGY_AND_LIMITATIONS.md
and the citizen-frontend/ split) - it's trusted operator tooling, same as
backend/routes/mlops.py and backend/routes/reliability.py, which also expose
data with no auth check. This module follows that existing convention rather
than inventing a separate admin-auth system: it only ever reads the users
table (via backend.services.auth_service's engine/table), never mutates it -
registration, login, and alert-city changes stay exclusively citizen-frontend's
job through backend/routes/auth.py.

Never returns password_hash - see _row_to_admin_user below.
"""

from sqlalchemy import text

from database.db_connection import get_engine, ensure_users_table
from backend.services import alert_service

engine = get_engine()
ensure_users_table()


def _row_to_admin_user(row):
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "alert_city": row["alert_city"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "last_alerted_risk": row["last_alerted_risk"],
        "notification_count": int(row["notification_count"] or 0),
        "last_notified_at": row["last_notified_at"].isoformat() if row["last_notified_at"] else None,
    }


def get_all_users():
    """Every registered (citizen-frontend) user, newest first, with their
    notification history count and the CURRENT live risk for their
    alert_city attached - so the operator can see at a glance who's
    subscribed to an area that's actually under risk right now, not just
    the tier they were last notified about.

    One alert_service.get_alert_for_city() call per DISTINCT alert_city,
    not per user - matches the same city-caching pattern
    backend/services/notification_service.py::run_notification_cycle
    already uses, since get_latest_predictions() is the expensive part."""

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    u.id, u.full_name, u.email, u.phone, u.alert_city,
                    u.created_at, u.last_alerted_risk,
                    COUNT(n.id) AS notification_count,
                    MAX(n.created_at) AS last_notified_at
                FROM users u
                LEFT JOIN alert_notifications n ON n.user_id = u.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
                """
            )
        ).mappings().all()

    users = [_row_to_admin_user(row) for row in rows]

    alert_by_city = {}
    for user in users:
        city = user["alert_city"]
        if city not in alert_by_city:
            alert_by_city[city] = alert_service.get_alert_for_city(city)
        alert = alert_by_city[city]

        user["current_risk_level"] = alert["risk_level"] if alert["has_data"] else None
        user["current_risk_label"] = alert["risk_label"] if alert["has_data"] else None
        user["current_is_alert"] = alert["is_alert"] if alert["has_data"] else False

    return users
