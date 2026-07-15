import api from "./api";

export const runPipeline = async () => {
  const response = await api.post("/system/run-pipeline");
  return response.data;
};