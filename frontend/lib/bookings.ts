import api from "@/lib/api";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled";

export type BookingPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface BookingPayment {
  id: number;
  amount: string | number;
  status: BookingPaymentStatus;
  payment_method: string | null;
  paid_at: string | null;
}

export interface BookingUser {
  id: number;
  name: string;
  email: string;
}

export interface BookingResource {
  id: number;
  name: string;
  type: string;
}

export interface BookingWorkspace {
  id: number;
  name: string;
  city: string;
}

export interface Booking {
  id: number;
  start_at: string;
  end_at: string;
  total_price: string | number;
  status: BookingStatus;
  payment_status?: BookingPaymentStatus | null;
  payment?: BookingPayment | null;
  user: BookingUser;
  resource: BookingResource;
  workspace?: BookingWorkspace;
}

export interface CreateBookingData {
  customer_id?: number;
  resource_id: number;
  start_at: string;
  end_at: string;
}

export interface BookingQuoteInput {
  resource_id: number;
  start_at: string;
  end_at: string;
}

export interface BookingQuote {
  total_price: number;
  pricing_unit: string;
  unit_price: string | number;
}

export interface WorkspaceCustomer {
  id: number;
  name: string;
  email: string;
}

export interface UpdateBookingData {
  resource_id?: number;
  start_at?: string;
  end_at?: string;
}

interface BookingsResponse {
  bookings: Booking[];
}

interface BookingResponse {
  message: string;
  booking: Booking;
}

export async function getBookings(
  workspaceId: number,
): Promise<Booking[]> {
  const response = await api.get<BookingsResponse>(
    `/workspaces/${workspaceId}/bookings`,
  );

  return response.data.bookings;
}

export async function getWorkspaceCustomers(workspaceId: number): Promise<WorkspaceCustomer[]> {
  const response = await api.get<{ customers: WorkspaceCustomer[] }>(`/workspaces/${workspaceId}/customers`);
  return response.data.customers;
}

export async function getBookingQuote(workspaceId: number, data: BookingQuoteInput): Promise<BookingQuote> {
  const response = await api.post<BookingQuote>(`/workspaces/${workspaceId}/bookings/quote`, data);
  return response.data;
}

interface OwnerNotificationsResponse {
  notifications: Booking[];
  unread_count: number;
}

export async function getMyBookings(): Promise<Booking[]> {
  const response = await api.get<BookingsResponse>("/my-bookings");

  return response.data.bookings;
}

export async function getOwnerNotifications(): Promise<OwnerNotificationsResponse> {
  const response = await api.get<OwnerNotificationsResponse>("/owner/notifications");

  return response.data;
}

export async function createBooking(
  workspaceId: number,
  data: CreateBookingData,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings`,
    data,
  );

  return response.data.booking;
}

export async function updateBooking(
  workspaceId: number,
  bookingId: number,
  data: UpdateBookingData,
): Promise<Booking> {
  const response = await api.put<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}`,
    data,
  );

  return response.data.booking;
}

export async function confirmBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/confirm`,
  );

  return response.data.booking;
}

export async function checkInBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/check-in`,
  );

  return response.data.booking;
}

export async function completeBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/complete`,
  );

  return response.data.booking;
}

export async function cancelBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/cancel`,
  );

  return response.data.booking;
}
