import api from "./api";

export const getLatestWeather = async () => {
  const response = await api.get("/weather/latest");
  return response.data;
};

export const getWeatherHistory = async () => {
  const response = await api.get("/weather/history");
  return response.data;
};