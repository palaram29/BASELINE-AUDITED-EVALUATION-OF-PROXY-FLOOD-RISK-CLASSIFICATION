from backend.services.prediction_service import get_latest_predictions

# Mirrors flood-frontend/src/utils/riskLevels.js's normalizeRisk(). The ML
# model's real Predicted_Risk labels are Low/Medium/High/Extreme (see
# ML/data/train_dataset.csv's Flood_Risk column) - "Extreme" must be
# recognised here too, or the most severe predictions would never raise an
# alert.
RISK_LABELS = {
    "Very High": "Critical",
    "High": "High",
    "Medium": "Moderate",
    "Low": "Low",
}


def normalize_risk(raw):
    value = (raw or "").strip().lower()
    if any(word in value for word in ("very", "extreme", "severe", "critical")):
        return "Very High"
    if "high" in value:
        return "High"
    if "medium" in value or "moderate" in value:
        return "Medium"
    return "Low"


def get_alert_for_city(city):
    """Current flood-alert status for one city, derived from the latest
    ML prediction for it. Returns a graceful "no data" state if the
    pipeline hasn't produced a prediction for that city yet."""

    predictions = get_latest_predictions()
    match = next((row for row in predictions if row.get("City") == city), None)

    if not match:
        return {
            "city": city,
            "has_data": False,
            "risk_level": None,
            "risk_label": None,
            "is_alert": False,
            "message": f"No recent flood-risk forecast available for {city} yet.",
            "rainfall_3day": None,
            "date": None,
            "predicted_for_date": None,
        }

    risk_level = normalize_risk(match.get("Predicted_Risk"))
    risk_label = RISK_LABELS[risk_level]
    is_alert = risk_level in ("Medium", "High", "Very High")
    predicted_for_date = match.get("Predicted_For_Date")
    when = f"for {predicted_for_date}" if predicted_for_date else "for tomorrow"

    # Wording is deliberately "predicted"/"forecast risk", never "is
    # flooding" or "flood detected" - the target is a derived next-day
    # risk index, not an observed flood event. See
    # docs/ML_METHODOLOGY_AND_LIMITATIONS.md before changing this copy.
    if risk_level == "Very High":
        message = f"{city} has a CRITICAL flood-risk forecast {when}. Take precautions."
    elif risk_level == "High":
        message = f"{city} has a high flood-risk forecast {when}."
    elif risk_level == "Medium":
        message = f"{city} has a moderate flood-risk forecast {when}. Stay alert."
    else:
        message = f"{city} has a low flood-risk forecast {when}."

    return {
        "city": city,
        "has_data": True,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "is_alert": is_alert,
        "message": message,
        "rainfall_3day": match.get("Rainfall_3Day"),
        "date": match.get("Date"),
        "predicted_for_date": predicted_for_date,
    }
