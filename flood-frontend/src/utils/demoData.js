export const demoWeather = [
  { City: "Colombo", Rainfall: 42.5, Temperature: 31.2, WindSpeed: 18.4, Date: "2026-06-11" },
  { City: "Kandy", Rainfall: 31.8, Temperature: 24.3, WindSpeed: 12.7, Date: "2026-06-11" },
  { City: "Galle", Rainfall: 58.9, Temperature: 29.1, WindSpeed: 22.6, Date: "2026-06-11" },
  { City: "Jaffna", Rainfall: 12.4, Temperature: 34.8, WindSpeed: 9.6, Date: "2026-06-11" },
  { City: "Kurunegala", Rainfall: 27.1, Temperature: 28.9, WindSpeed: 15.3, Date: "2026-06-11" },
];

export const demoRiver = [
  { River: "Kelani", Station: "Hanwella", WaterLevel: 9.4, PreviousWaterLevel: 9.1, AlertLevel: 8.0, MinorFloodLevel: 10.0, MajorFloodLevel: 12.0, Status: "Alert", RiverRisk: "High" },
  { River: "Mahaweli", Station: "Kotmale", WaterLevel: 7.2, PreviousWaterLevel: 7.3, AlertLevel: 7.0, MinorFloodLevel: 9.0, MajorFloodLevel: 11.0, Status: "Watch", RiverRisk: "Moderate" },
  { River: "Nilwala", Station: "Matara", WaterLevel: 6.8, PreviousWaterLevel: 6.6, AlertLevel: 8.0, MinorFloodLevel: 9.5, MajorFloodLevel: 11.0, Status: "Normal", RiverRisk: "Low" },
  { River: "Kalu", Station: "Ratnapura", WaterLevel: 10.1, PreviousWaterLevel: 9.7, AlertLevel: 9.0, MinorFloodLevel: 11.0, MajorFloodLevel: 13.0, Status: "Alert", RiverRisk: "High" },
];

export const demoPredictions = [
  { City: "Colombo", Rainfall_3Day: 76, Avg_Temperature: 32.1, Avg_WindSpeed: 19.2, Predicted_Risk: "High", Date: "2026-06-11" },
  { City: "Kandy", Rainfall_3Day: 44, Avg_Temperature: 24.8, Avg_WindSpeed: 13.5, Predicted_Risk: "Moderate", Date: "2026-06-11" },
  { City: "Galle", Rainfall_3Day: 81, Avg_Temperature: 29.7, Avg_WindSpeed: 21.8, Predicted_Risk: "High", Date: "2026-06-11" },
  { City: "Jaffna", Rainfall_3Day: 23, Avg_Temperature: 34.2, Avg_WindSpeed: 10.1, Predicted_Risk: "Low", Date: "2026-06-11" },
];

// Same-day ("Today") rule-based risk index - the counterpart to
// demoPredictions (the t+1 "Tomorrow" ML forecast).
export const demoLiveRisk = [
  { City: "Colombo", Rainfall_3Day: 76, Avg_Temperature: 32.1, Avg_WindSpeed: 19.2, Risk_Level: "High", Risk_Score: 0.14, Method: "rule_based_hazard_vulnerability", Date: "2026-06-11" },
  { City: "Kandy", Rainfall_3Day: 44, Avg_Temperature: 24.8, Avg_WindSpeed: 13.5, Risk_Level: "Low", Risk_Score: 0.02, Method: "rule_based_hazard_vulnerability", Date: "2026-06-11" },
  { City: "Galle", Rainfall_3Day: 81, Avg_Temperature: 29.7, Avg_WindSpeed: 21.8, Risk_Level: "Medium", Risk_Score: 0.1, Method: "rule_based_hazard_vulnerability", Date: "2026-06-11" },
  { City: "Jaffna", Rainfall_3Day: 23, Avg_Temperature: 34.2, Avg_WindSpeed: 10.1, Risk_Level: "Low", Risk_Score: 0.01, Method: "rule_based_hazard_vulnerability", Date: "2026-06-11" },
];

export const demoStatistics = {
  weatherStations: 8,
  riverStations: 12,
  predictionCount: 4,
  highRiskRivers: 2,
  highRiskPredictions: 2,
};

export const demoPipelineStatus = {
  status: "ready",
  message: "The ingestion pipeline is configured and ready to run.",
};
