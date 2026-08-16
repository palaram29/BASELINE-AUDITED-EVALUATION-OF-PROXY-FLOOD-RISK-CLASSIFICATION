import api from "./api";

// ML model-comparison dashboard API. Mirrors backend/routes/ml.py 1:1.
//
// There is deliberately no trainModels()/POST /train here - the
// production model is trained and frozen offline
// (`python ML/train_models.py`), never retrained by the live app. See
// docs/ML_METHODOLOGY_AND_LIMITATIONS.md "Production deployment: frozen
// model policy".

export const getModels = async () => {
  const response = await api.get("/models");
  return response.data;
};

export const getBestModel = async () => {
  const response = await api.get("/best-model");
  return response.data;
};

export const predictBestModel = async (city) => {
  const response = await api.post("/predict", { city });
  return response.data;
};

export const getMLPredictionHistory = async () => {
  const response = await api.get("/history");
  return response.data;
};
