import os

# =====================================================
# WEATHER API
# =====================================================

WEATHER_API_URL = "https://api.weatherapi.com/v1/current.json"

# =====================================================
# ML MODEL FILES
# =====================================================

MODEL_FILE = "ML_Training/flood_prediction_model.pkl"

CITY_ENCODER_FILE = "ML_Training/city_encoder.pkl"

LABEL_ENCODER_FILE = "ML_Training/flood_label_encoder.pkl"

# =====================================================
# CITIES
# =====================================================

CITIES = [
    "Colombo",
    "Mount Lavinia",
    "Kesbewa",
    "Moratuwa",
    "Maharagama",
    "Ratnapura",
    "Kandy",
    "Negombo",
    "Sri Jayewardenepura Kotte",
    "Kalmunai",
    "Trincomalee",
    "Galle",
    "Jaffna",
    "Athurugiriya",
    "Weligama",
    "Matara",
    "Kolonnawa",
    "Gampaha",
    "Puttalam",
    "Badulla",
    "Kalutara",
    "Bentota",
    "Matale",
    "Mannar",
    "Pothuhera",
    "Kurunegala",
    "Mabole",
    "Hatton",
    "Hambantota",
    "Oruwala"
]