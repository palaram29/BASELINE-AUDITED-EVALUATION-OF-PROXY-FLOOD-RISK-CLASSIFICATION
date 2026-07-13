# 🌊 Flood Prediction System

A **Cloud-Based Flood Prediction System** developed as a Final Year Research Project. The system collects real-time weather and river water level data, processes the data using Machine Learning, and predicts flood risk for selected locations in Sri Lanka through a RESTful API built with FastAPI.

---

## 📌 Project Overview

The Flood Prediction System automates the complete flood prediction workflow by:

- Collecting weather data from WeatherAPI
- Monitoring river water levels from the Sri Lanka Disaster Management Centre (DMC)
- Extracting river data from PDF reports
- Generating machine learning features
- Predicting flood risk using a trained ML model
- Providing REST APIs for frontend integration

---

## 🚀 Features

- 🌦 Real-time Weather Data Collection
- 🌊 River Water Level Monitoring
- 📄 Automatic PDF Extraction from DMC Reports
- 📊 River Risk Analysis
- 🤖 Machine Learning Flood Prediction
- 🗄 PostgreSQL Database Integration
- ⚡ FastAPI REST APIs
- 🔄 Automated Prediction Pipeline
- 📝 Centralized Logging

---

## 🛠 Technologies Used

### Backend

- Python 3.13
- FastAPI
- Uvicorn

### Database

- PostgreSQL
- SQLAlchemy

### Machine Learning

- Scikit-learn
- Pandas
- Joblib

### Data Collection

- Requests
- BeautifulSoup4
- PDFPlumber
- Schedule

### Configuration

- Python Dotenv

---

## 📂 Project Structure

```
Flood_Prediction_System/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.py
│   ├── config.py
│   ├── weather_collector.py
│   ├── river_scraper.py
│   ├── extract_river_data.py
│   ├── river_risk_engine.py
│   ├── generate_ml_features.py
│   └── predict_flood.py
│
├── database/
│   ├── db_connection.py
│   └── test_db.py
│
├── ML_Training/
│   ├── ML_Training.py
│   ├── flood_prediction_model.pkl
│   ├── city_encoder.pkl
│   └── flood_label_encoder.pkl
│
├── requirements.txt
├── .env.example
├── README.md
└── .gitignore
```

---

## ⚙️ Installation

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Flood_Prediction_System.git
```

### Navigate into the project

```bash
cd Flood_Prediction_System
```

### Install dependencies

```bash
pip install -r requirements.txt
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root.

Example:

```env
WEATHER_API_KEY=YOUR_WEATHER_API_KEY

DB_HOST=localhost
DB_PORT=5432
DB_NAME=flood_prediction
DB_USER=postgres
DB_PASSWORD=your_password
```

---

## ▶️ Running the Backend

Start the FastAPI server:

```bash
python -m uvicorn backend.app:app --reload
```

Server:

```
http://127.0.0.1:8000
```

Swagger Documentation:

```
http://127.0.0.1:8000/docs
```

---

## 🔄 Prediction Pipeline

The complete workflow is:

```
Weather API
      │
      ▼
Weather Collector
      │
      ▼
PostgreSQL
      │
      ▼
River Scraper
      │
      ▼
PDF Extraction
      │
      ▼
River Risk Engine
      │
      ▼
ML Feature Generator
      │
      ▼
Flood Prediction Model
      │
      ▼
Prediction Results
```

---

## 📡 Available API Endpoints

| Method | Endpoint               | Description               |
| ------ | ---------------------- | ------------------------- |
| GET    | `/`                    | API Home                  |
| GET    | `/docs`                | Swagger Documentation     |
| GET    | `/health`              | System Health             |
| GET    | `/dashboard`           | Dashboard Data            |
| GET    | `/stats`               | Statistics                |
| GET    | `/weather/latest`      | Latest Weather Data       |
| GET    | `/river/latest`        | Latest River Data         |
| GET    | `/prediction/latest`   | Latest Flood Predictions  |
| POST   | `/system/weather`      | Collect Weather Data      |
| POST   | `/system/river`        | Collect River Data        |
| POST   | `/system/ml`           | Generate ML Features      |
| POST   | `/system/predict`      | Predict Flood Risk        |
| POST   | `/system/run-pipeline` | Execute Complete Pipeline |

---

## 🧠 Machine Learning

### Input Features

- City
- 3-Day Rainfall
- Average Temperature
- Average Wind Speed
- Elevation

### Output

- Low Risk
- Medium Risk
- High Risk
- Very High Risk

---

## 📊 Database

The project uses PostgreSQL to store:

- Weather Data
- River Data
- ML Features
- Flood Prediction Results

---

## 📈 Future Improvements

- React Dashboard
- Interactive Maps
- Real-time Notifications
- SMS & Email Alerts
- Historical Trend Analysis
- Docker Deployment
- CI/CD Pipeline

---

## 👨‍💻 Author

**Palaram Ramanathan**

Final Year Undergraduate

BSc (Hons) Computer Science

---

## 📄 License

This project was developed for academic and research purposes.
