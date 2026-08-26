import api from "./api";

// Read-only user-management API. Mirrors backend/routes/admin.py 1:1.
export const getUsers = async () => {
  const response = await api.get("/admin/users");
  return response.data;
};
