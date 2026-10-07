import api from "@/lib/api";

export interface DashboardBookings {
  total: number;
  pending: number;
  confirmed: number;
  checked_in: number;
  completed: number;
  cancelled: number;
}

export interface DashboardRevenue {
  total: number;
  current_period: number;
}

export interface DashboardResources {
  total: number;
  active: number;
}

export interface DashboardToday {
  bookings: number;
}

export interface RecentBooking {
  id: number;
  start_at: string;
  end_at: string;
  total_price: number;
  status: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  resource: {
    id: number;
    name: string;
    type: string;
  };
}

export interface DashboardData {
  bookings: DashboardBookings;
  revenue: DashboardRevenue;
  resources: DashboardResources;
  today: DashboardToday;
  members: { total: number };
  recent_bookings: RecentBooking[];
}

interface DashboardResponse {
  dashboard: DashboardData;
}

export async function getDashboard(
  workspaceId: number,
): Promise<DashboardData> {
  const response = await api.get<DashboardResponse>(
    `/workspaces/${workspaceId}/dashboard`,
  );

  return response.data.dashboard;
}
