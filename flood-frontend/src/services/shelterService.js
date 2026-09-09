import api from "./api";
import { OPERATOR_API_KEY } from "../constants/api";

// Shelter management API. Mirrors backend/routes/shelters.py 1:1.
// Write calls (create/update/delete) now require the operator-key
// header the backend checks via require_operator_key - reads (list) are
// unauthenticated on both sides, unchanged.
const OPERATOR_HEADERS = { headers: { "X-Operator-Key": OPERATOR_API_KEY } };

export const getShelters = async () => (await api.get("/shelters")).data;

export const createShelter = async (shelter) =>
  (await api.post("/shelters", shelter, OPERATOR_HEADERS)).data;

export const updateShelter = async (id, changes) =>
  (await api.put(`/shelters/${id}`, changes, OPERATOR_HEADERS)).data;

export const deleteShelter = async (id) =>
  (await api.delete(`/shelters/${id}`, OPERATOR_HEADERS)).data;
