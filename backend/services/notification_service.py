"""In-app flood-alert notifications for citizen-app users.

After every successful pipeline run (see backend/scheduler.py) this
compares each registered user's alert_city risk to the tier they were
last notified about (users.last_alerted_risk) and drops a row into
alert_notifications only when the risk has *risen* into a higher tier -
so a user isn't re-alerted every hour while conditions simply stay bad.
When conditions ease back below "Moderate" the watermark is cleared, so a
later rise raises a fresh alert.

Delivery is in-app only: citizen-frontend/ reads GET /notifications and
shows a notification centre. Nothing is emailed or texted.
"""

from sqlalchemy import text

from database.db_connection import get_engine, ensure_notifications_schema
from backend.services import alert_service
from backend.utils.logger import logger

engine = get_engine()
ensure_notifications_schema()

# Normalised tiers (alert_service.normalize_risk output) in ascending
# order of severity. "Medium" is the lowest tier that raises a
# notification - matching alert_service.get_alert_for_city's is_alert.
_RISK_RANK = {"Low": 0, "Medium": 1, "High": 2, "Very High": 3}
_MIN_ALERT_RANK = _RISK_RANK["Medium"]

_TITLE_BY_LEVEL = {
    "Medium": "Moderate flood risk for {city}",
    "High": "High flood risk for {city}",
    "Very High": "Critical flood risk for {city}",
}


def _rank(risk_level):
    return _RISK_RANK.get(risk_level, -1)


def _users_with_cities():
    with engine.connect() as conn:
        rows = conn.execute(text(
            'SELECT id, alert_city, last_alerted_risk FROM users'
        )).mappings().all()
    return [dict(row) for row in rows]


def _set_watermark(conn, user_id, risk_level):
    conn.execute(
        text('UPDATE users SET last_alerted_risk = :risk WHERE id = :id'),
        {"risk": risk_level, "id": user_id},
    )


def _insert_notification(conn, user_id, alert):
    risk_level = alert["risk_level"]
    title = _TITLE_BY_LEVEL.get(risk_level, "Flood risk update for {city}").format(
        city=alert["city"]
    )
    conn.execute(
        text(
            """
            INSERT INTO alert_notifications
                (user_id, city, risk_level, risk_label, title, body,
                 rainfall_3day, predicted_for_date)
            VALUES
                (:user_id, :city, :risk_level, :risk_label, :title, :body,
                 :rainfall_3day, :predicted_for_date)
            """
        ),
        {
            "user_id": user_id,
            "city": alert["city"],
            "risk_level": risk_level,
            "risk_label": alert["risk_label"],
            "title": title,
            "body": alert["message"],
            "rainfall_3day": alert.get("rainfall_3day"),
            "predicted_for_date": alert.get("predicted_for_date"),
        },
    )


def run_notification_cycle():
    """Evaluate every user's alert_city and create notifications for those
    whose risk has risen into a higher tier. Returns a small summary dict
    for logging/tests. Safe to call repeatedly - it's idempotent between
    pipeline runs because of the last_alerted_risk watermark."""

    users = _users_with_cities()
    if not users:
        return {"users": 0, "created": 0}

    # One alert lookup per distinct city, not per user.
    alert_by_city = {}
    created = 0

    with engine.begin() as conn:
        for user in users:
            city = user["alert_city"]

            if city not in alert_by_city:
                alert_by_city[city] = alert_service.get_alert_for_city(city)
            alert = alert_by_city[city]

            if not alert.get("has_data"):
                continue

            current = alert["risk_level"]
            previous = user["last_alerted_risk"]
            current_rank = _rank(current)
            previous_rank = _rank(previous)

            if current_rank >= _MIN_ALERT_RANK and current_rank > previous_rank:
                _insert_notification(conn, user["id"], alert)
                created += 1

            # Keep the watermark in step with the current tier either way,
            # so an ease-off (High -> Medium) lets a later High re-alert.
            if current != previous:
                _set_watermark(conn, user["id"], current)

    if created:
        logger.info(f"Notification cycle: created {created} new alert(s) for {len(users)} user(s)")

    return {"users": len(users), "created": created}


def list_notifications(user_id, limit=50):
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, city, risk_level, risk_label, title, body,
                       rainfall_3day, predicted_for_date, is_read, created_at
                FROM alert_notifications
                WHERE user_id = :user_id
                ORDER BY created_at DESC, id DESC
                LIMIT :limit
                """
            ),
            {"user_id": user_id, "limit": limit},
        ).mappings().all()

    result = []
    for row in rows:
        item = dict(row)
        item["created_at"] = item["created_at"].isoformat() if item["created_at"] else None
        item["predicted_for_date"] = (
            item["predicted_for_date"].isoformat() if item["predicted_for_date"] else None
        )
        result.append(item)
    return result


def unread_count(user_id):
    with engine.connect() as conn:
        count = conn.execute(
            text(
                'SELECT COUNT(*) FROM alert_notifications '
                'WHERE user_id = :user_id AND is_read = FALSE'
            ),
            {"user_id": user_id},
        ).scalar()
    return {"unread": int(count or 0)}


def mark_read(user_id, notification_ids=None):
    """Mark the given notification ids read, or all of the user's
    notifications when notification_ids is None/empty. Scoped to user_id
    so one user can never touch another's rows."""

    with engine.begin() as conn:
        if notification_ids:
            conn.execute(
                text(
                    'UPDATE alert_notifications SET is_read = TRUE '
                    'WHERE user_id = :user_id AND id = ANY(:ids)'
                ),
                {"user_id": user_id, "ids": list(notification_ids)},
            )
        else:
            conn.execute(
                text(
                    'UPDATE alert_notifications SET is_read = TRUE '
                    'WHERE user_id = :user_id AND is_read = FALSE'
                ),
                {"user_id": user_id},
            )

    return unread_count(user_id)
