import api from "@/lib/api";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

export interface NotificationPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface NotificationsPageData {
  notifications: AppNotification[];
  unread_count: number;
  pagination: NotificationPagination;
}

export async function getNotifications(options: {
  filter?: "all" | "unread";
  page?: number;
  perPage?: number;
} = {}): Promise<NotificationsPageData> {
  const response = await api.get<NotificationsPageData>("/notifications", {
    params: {
      filter: options.filter ?? "all",
      page: options.page ?? 1,
      per_page: options.perPage ?? 15,
    },
  });
  return response.data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await api.get<{ unread_count: number }>("/notifications/unread-count");
  return response.data.unread_count;
}

export async function markNotificationRead(notificationId: string): Promise<number> {
  const response = await api.patch<{ unread_count: number }>(`/notifications/${encodeURIComponent(notificationId)}/read`);
  return response.data.unread_count;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await api.post<{ unread_count: number }>("/notifications/read-all");
  return response.data.unread_count;
}

export async function deleteNotification(notificationId: string): Promise<number> {
  const response = await api.delete<{ unread_count: number }>(`/notifications/${encodeURIComponent(notificationId)}`);
  return response.data.unread_count;
}

export async function deleteAllNotifications(): Promise<void> {
  await api.delete("/notifications");
}
