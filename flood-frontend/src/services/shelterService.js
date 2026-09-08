import api from "./api";

// Shelter management API. Mirrors backend/routes/shelters.py 1:1.
export const getShelters = async () => (await api.get("/shelters")).data;

export const createShelter = async (shelter) => (await api.post("/shelters", shelter)).data;

export const updateShelter = async (id, changes) =>
  (await api.put(`/shelters/${id}`, changes)).data;

export const deleteShelter = async (id) => (await api.delete(`/shelters/${id}`)).data;
