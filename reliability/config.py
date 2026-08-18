"""
Configurable constants for the Data Source Reliability layer.

Same convention as backend/config.py: every threshold is an
os.getenv()-overridable constant with a documented default, grouped under
banner comments, so weights/thresholds can be recalibrated experimentally
(see docs on the research hypothesis) without a code change.

This module is intentionally free of any backend/ or ML/ imports so it can
be used identically from the live backend service, the offline ML training
pipeline, and the degraded-data experiment runner with no circular-import
risk.
"""

import os

# =====================================================
# RELIABILITY FORMULA WEIGHTS
# R = w1*Completeness + w2*Timeliness + w3*Validity + w4*Historical
# =====================================================

RELIABILITY_WEIGHT_COMPLETENESS = float(os.getenv("RELIABILITY_WEIGHT_COMPLETENESS", "0.25"))
RELIABILITY_WEIGHT_TIMELINESS = float(os.getenv("RELIABILITY_WEIGHT_TIMELINESS", "0.25"))
RELIABILITY_WEIGHT_VALIDITY = float(os.getenv("RELIABILITY_WEIGHT_VALIDITY", "0.25"))
RELIABILITY_WEIGHT_HISTORICAL = float(os.getenv("RELIABILITY_WEIGHT_HISTORICAL", "0.25"))

_weight_sum = (
    RELIABILITY_WEIGHT_COMPLETENESS
    + RELIABILITY_WEIGHT_TIMELINESS
    + RELIABILITY_WEIGHT_VALIDITY
    + RELIABILITY_WEIGHT_HISTORICAL
)
if abs(_weight_sum - 1.0) > 1e-6:
    raise ValueError(
        f"Reliability weights must sum to 1.0, got {_weight_sum} "
        "(check RELIABILITY_WEIGHT_* env vars)"
    )

# =====================================================
# CLASSIFICATION THRESHOLDS
# 0.80-1.00 -> HIGH, 0.60-0.79 -> MEDIUM, 0.00-0.59 -> LOW
# =====================================================

RELIABILITY_HIGH_THRESHOLD = float(os.getenv("RELIABILITY_HIGH_THRESHOLD", "0.80"))
RELIABILITY_MEDIUM_THRESHOLD = float(os.getenv("RELIABILITY_MEDIUM_THRESHOLD", "0.60"))

# =====================================================
# COMPLETENESS
# =====================================================
# Rolling window used to compute expected-vs-received record counts.
COMPLETENESS_WINDOW_DAYS = int(os.getenv("COMPLETENESS_WINDOW_DAYS", "7"))

# Fallback collection interval when a source doesn't yet have enough history
# to derive its own cadence from actual timestamp gaps. Matches
# backend/scheduler.py's PIPELINE_INTERVAL_MINUTES (the live pipeline's
# actual run cadence) rather than an invented number.
DEFAULT_COLLECTION_INTERVAL_MINUTES = int(
    os.getenv("DEFAULT_COLLECTION_INTERVAL_MINUTES", "60")
)

# =====================================================
# TIMELINESS
# =====================================================
# Delay <= acceptable -> score 1.0. Delay >= max -> score 0.0. Linear
# falloff in between. Tied to the pipeline's own 60-minute cadence: 90 min
# acceptable (1.5x the run interval, allows for one missed/slow cycle),
# 360 min (6x) treated as fully stale.
TIMELINESS_ACCEPTABLE_DELAY_MINUTES = float(
    os.getenv("TIMELINESS_ACCEPTABLE_DELAY_MINUTES", "90")
)
TIMELINESS_MAX_DELAY_MINUTES = float(os.getenv("TIMELINESS_MAX_DELAY_MINUTES", "360"))

# =====================================================
# VALIDITY - realistic ranges per environmental variable
# =====================================================

RAINFALL_MIN = float(os.getenv("RAINFALL_MIN", "0"))
RAINFALL_MAX = float(os.getenv("RAINFALL_MAX", "500"))  # mm/day, extreme tropical storm ceiling

TEMPERATURE_MIN = float(os.getenv("TEMPERATURE_MIN", "10"))  # deg C, Sri Lanka lowland/hill-country floor
TEMPERATURE_MAX = float(os.getenv("TEMPERATURE_MAX", "45"))  # deg C

WINDSPEED_MIN = float(os.getenv("WINDSPEED_MIN", "0"))
WINDSPEED_MAX = float(os.getenv("WINDSPEED_MAX", "250"))  # kph, cyclonic ceiling

RIVER_LEVEL_MIN = float(os.getenv("RIVER_LEVEL_MIN", "0"))
RIVER_LEVEL_MAX = float(os.getenv("RIVER_LEVEL_MAX", "50"))  # metres, generous gauge ceiling

OUTLIER_ZSCORE_THRESHOLD = float(os.getenv("OUTLIER_ZSCORE_THRESHOLD", "3.0"))

# =====================================================
# HISTORICAL RELIABILITY
# =====================================================
# Exponential moving average over a source's own past composite reliability
# scores. Higher alpha weighs the most recent observation more heavily.
HISTORICAL_RELIABILITY_EMA_ALPHA = float(os.getenv("HISTORICAL_RELIABILITY_EMA_ALPHA", "0.3"))

# Neutral prior used the first time a source is scored (no history yet).
HISTORICAL_RELIABILITY_DEFAULT = float(os.getenv("HISTORICAL_RELIABILITY_DEFAULT", "0.75"))

# Simple-average alternative mode (HISTORICAL_RELIABILITY_METHOD=average):
# how many past scores to average over instead of using the EMA.
HISTORICAL_RELIABILITY_LOOKBACK = int(os.getenv("HISTORICAL_RELIABILITY_LOOKBACK", "30"))
HISTORICAL_RELIABILITY_METHOD = os.getenv("HISTORICAL_RELIABILITY_METHOD", "ema")

# =====================================================
# ALERTING (feeds MLOps monitoring, see backend/services/mlops_service.py)
# =====================================================
RELIABILITY_ALERT_THRESHOLD = float(os.getenv("RELIABILITY_ALERT_THRESHOLD", "0.60"))

# =====================================================
# SOURCE COMBINATION (Weather_Reliability + River_Reliability ->
# Overall_Data_Reliability, see backend/generate_ml_features.py and
# ML/prepare_dataset.py)
# =====================================================
# Weather is weighted more heavily since it's available for every city;
# river coverage is only partial (see
# backend/services/reliability_service.py::CITY_TO_RIVER_STATION_MAP).
WEATHER_SOURCE_WEIGHT = float(os.getenv("WEATHER_SOURCE_WEIGHT", "0.6"))
RIVER_SOURCE_WEIGHT = float(os.getenv("RIVER_SOURCE_WEIGHT", "0.4"))

# Upper bound for a 3-DAY rainfall SUM (as opposed to RAINFALL_MAX, a
# single-day reading) - used when validating the Rainfall_3Day engineered
# feature in ML/prepare_dataset.py, where only the pre-aggregated 3-day sum
# is available, never the raw daily readings.
RAINFALL_3DAY_MAX = float(os.getenv("RAINFALL_3DAY_MAX", str(RAINFALL_MAX * 3)))
