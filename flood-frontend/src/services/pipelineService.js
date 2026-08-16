import api from "./api";

export const runPipeline = async () => {
  const response = await api.post("/system/run-pipeline");
  return response.data;
};

// The automatic scheduler's real run history (backend/scheduler.py) -
// not a hardcoded "ready" claim.
export const getPipelineStatus = async () => {
  const response = await api.get("/system/status");
  return response.data;
};