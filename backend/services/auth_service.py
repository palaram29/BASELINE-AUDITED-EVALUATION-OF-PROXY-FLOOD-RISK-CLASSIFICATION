import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import text

from database.db_connection import get_engine, ensure_users_table
from backend.utils.logger import logger

engine = get_engine()
ensure_users_table()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set in the environment (.env). "
        "Generate one (e.g. python -c \"import secrets; print(secrets.token_hex(32))\") "
        "and add it as JWT_SECRET=... before starting the API."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRES_DAYS = 7


class AuthError(Exception):
    """Raised for any register/login/token failure the routes layer
    should turn into a 4xx response."""


def _row_to_public_user(row):
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "alert_city": row["alert_city"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password, password_hash):
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash - treat as a non-match rather than crashing the request.
        return False


def create_access_token(user_id):
    expires_at = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise AuthError("Invalid or expired session. Please log in again.")


def register_user(full_name, email, phone, password, alert_city):
    email = email.strip().lower()

    with engine.begin() as conn:
        existing = conn.execute(
            text('SELECT id FROM users WHERE email = :email'),
            {"email": email},
        ).fetchone()

        if existing:
            raise AuthError("An account with this email already exists.")

        result = conn.execute(
            text(
                """
                INSERT INTO users (full_name, email, phone, password_hash, alert_city)
                VALUES (:full_name, :email, :phone, :password_hash, :alert_city)
                RETURNING id, full_name, email, phone, alert_city, created_at
                """
            ),
            {
                "full_name": full_name.strip(),
                "email": email,
                "phone": (phone or "").strip() or None,
                "password_hash": hash_password(password),
                "alert_city": alert_city,
            },
        )
        row = result.mappings().fetchone()

    logger.info(f"Registered new user: {email}")

    user = _row_to_public_user(row)
    token = create_access_token(user["id"])
    return {"user": user, "token": token}


def authenticate_user(email, password):
    email = email.strip().lower()

    with engine.connect() as conn:
        row = conn.execute(
            text(
                'SELECT id, full_name, email, phone, alert_city, created_at, password_hash '
                'FROM users WHERE email = :email'
            ),
            {"email": email},
        ).mappings().fetchone()

    if not row or not verify_password(password, row["password_hash"]):
        raise AuthError("Incorrect email or password.")

    user = _row_to_public_user(row)
    token = create_access_token(user["id"])
    return {"user": user, "token": token}


def get_user_by_id(user_id):
    with engine.connect() as conn:
        row = conn.execute(
            text(
                'SELECT id, full_name, email, phone, alert_city, created_at '
                'FROM users WHERE id = :id'
            ),
            {"id": user_id},
        ).mappings().fetchone()

    if not row:
        raise AuthError("Account not found.")

    return _row_to_public_user(row)


def update_alert_city(user_id, alert_city):
    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE users SET alert_city = :alert_city WHERE id = :id
                RETURNING id, full_name, email, phone, alert_city, created_at
                """
            ),
            {"alert_city": alert_city, "id": user_id},
        )
        row = result.mappings().fetchone()

    if not row:
        raise AuthError("Account not found.")

    return _row_to_public_user(row)


def update_profile(user_id, full_name=None, phone=None, email=None):
    """Edits full_name/phone/email. Each argument is only applied if it's
    not None, so a caller can update just one field - alert_city has its
    own dedicated endpoint/function above and isn't touched here."""

    updates = {}

    if full_name is not None:
        full_name = full_name.strip()
        if not full_name:
            raise AuthError("Full name cannot be empty.")
        updates["full_name"] = full_name

    if phone is not None:
        updates["phone"] = phone.strip() or None

    if email is not None:
        email = email.strip().lower()
        if not email:
            raise AuthError("Email cannot be empty.")
        updates["email"] = email

    if not updates:
        return get_user_by_id(user_id)

    with engine.begin() as conn:
        if "email" in updates:
            existing = conn.execute(
                text('SELECT id FROM users WHERE email = :email AND id != :id'),
                {"email": updates["email"], "id": user_id},
            ).fetchone()
            if existing:
                raise AuthError("An account with this email already exists.")

        # `updates` keys only ever come from the three fixed field names
        # above, never from caller-supplied strings, so building the SET
        # clause this way carries no injection risk.
        set_clause = ", ".join(f"{column} = :{column}" for column in updates)
        result = conn.execute(
            text(
                f"""
                UPDATE users SET {set_clause} WHERE id = :id
                RETURNING id, full_name, email, phone, alert_city, created_at
                """
            ),
            {**updates, "id": user_id},
        )
        row = result.mappings().fetchone()

    if not row:
        raise AuthError("Account not found.")

    logger.info(f"Updated profile for user id={user_id}: {list(updates.keys())}")

    return _row_to_public_user(row)


def delete_account(user_id, password):
    """Permanently deletes the account - requires the current password so
    a merely-stolen/leaked JWT (valid for JWT_EXPIRES_DAYS) can't be used
    alone to destroy the account. alert_notifications rows for this user
    are removed automatically (ON DELETE CASCADE - see
    database.db_connection.ensure_notifications_schema)."""

    with engine.begin() as conn:
        row = conn.execute(
            text('SELECT password_hash FROM users WHERE id = :id'),
            {"id": user_id},
        ).mappings().fetchone()

        if not row:
            raise AuthError("Account not found.")

        if not verify_password(password, row["password_hash"]):
            raise AuthError("Incorrect password.")

        conn.execute(text('DELETE FROM users WHERE id = :id'), {"id": user_id})

    logger.info(f"Deleted user account id={user_id}")
