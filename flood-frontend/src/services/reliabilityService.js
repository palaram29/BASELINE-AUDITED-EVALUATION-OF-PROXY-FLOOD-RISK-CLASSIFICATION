import api from "./api";

// Data Source Reliability API. Mirrors backend/routes/reliability.py 1:1.
//
// Distinct from mlopsService.js's getDataQuality() (GET /mlops/data-quality)
// - that's a simpler, pre-existing aggregate missing-rate score. This is
// the per-source, four-component (Completeness/Timeliness/Validity/
// Historical) weighted reliability layer.

export const getOverallReliability = async () => {
  const response = await api.get("/reliability/");
  return response.data;
};

export const getReliabilitySummary = async () => {
  const response = await api.get("/reliability/summary");
  return response.data;
};

export const getReliabilitySources = async (sourceType) => {
  const response = await api.get("/reliability/sources", {
    params: sourceType ? { source_type: sourceType } : {},
  });
  return response.data;
};

export const getReliabilityHistory = async (source, days = 30) => {
  const response = await api.get("/reliability/history", { params: { source, days } });
  return response.data;
};

export const getValidationFlags = async (source, limit = 50) => {
  const response = await api.get("/reliability/validation-flags", {
    params: { ...(source ? { source } : {}), limit },
  });
  return response.data;
};
