import api from "./api";

export const getNotifications = async () => (await api.get("/notifications")).data;

export const getUnreadCount = async () =>
  (await api.get("/notifications/unread-count")).data;

// ids omitted => mark all of the user's unread notifications as read.
export const markRead = async (ids) =>
  (await api.post("/notifications/mark-read", { ids: ids ?? null })).data;
