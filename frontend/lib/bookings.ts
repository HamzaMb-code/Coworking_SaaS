import api from "@/lib/api";
import type { ResourceType } from "@/lib/resources";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show";

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
  type: ResourceType;
  image_url: string | null;
}

export interface BookingWorkspace {
  id: number;
  name: string;
  city: string;
}

export interface Booking {
  id: number;
  created_at: string;
  start_at: string;
  end_at: string;
  payment_deadline_at?: string | null;
  expired?: boolean;
  checked_in_at: string | null;
  checked_out_at: string | null;
  is_overdue: boolean;
  can_check_in: boolean;
  total_price: string | number;
  payment_method: "bank_transfer" | "cash" | string | null;
  verified_amount?: number;
  outstanding_balance?: number;
  pending_payment_amount?: number;
  fully_paid?: boolean;
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
  payment_method: "bank_transfer" | "cash";
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
  created_at?: string;
  workspace_bookings_count?: number;
}

export interface WorkspaceCustomerPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface WorkspaceCustomerPage {
  customers: WorkspaceCustomer[];
  pagination: WorkspaceCustomerPagination;
}

export interface WorkspaceCustomerDetails extends WorkspaceCustomer {
  bookings_count: number;
}

export interface WorkspaceCustomerDetailsPage {
  customer: WorkspaceCustomerDetails;
  bookings: Booking[];
  pagination: WorkspaceCustomerPagination;
}

export interface UpdateBookingData {
  resource_id?: number;
  start_at?: string;
  end_at?: string;
}

interface BookingsResponse {
  bookings: Booking[];
}

export interface BookingListPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface BookingListPage {
  bookings: Booking[];
  pagination: BookingListPagination;
  counts?: Partial<Record<BookingStatus, number>>;
}

export interface BookingListOptions {
  tab?: "upcoming" | "history" | "all";
  status?: BookingStatus | "";
  paymentStatus?: BookingPaymentStatus | "unpaid" | "";
  paymentMethod?: "bank_transfer" | "cash" | "";
  from?: string;
  to?: string;
  search?: string;
  resourceId?: string;
  page?: number;
  perPage?: number;
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

export async function getBookingsPage(workspaceId: number, options: BookingListOptions): Promise<BookingListPage> {
  const response = await api.get<BookingListPage>(`/workspaces/${workspaceId}/bookings`, {
    params: {
      tab: options.tab,
      status: options.status || undefined,
      payment_status: options.paymentStatus || undefined,
      payment_method: options.paymentMethod || undefined,
      from: options.from || undefined,
      to: options.to || undefined,
      search: options.search?.trim() || undefined,
      resource_id: options.resourceId || undefined,
      page: options.page ?? 1,
      per_page: options.perPage ?? 10,
    },
  });
  return response.data;
}

export async function getWorkspaceCustomers(workspaceId: number): Promise<WorkspaceCustomer[]> {
  const response = await getWorkspaceCustomersPage(workspaceId, { perPage: 100 });
  return response.customers;
}

export async function getWorkspaceCustomersPage(
  workspaceId: number,
  options: { search?: string; page?: number; perPage?: number } = {},
): Promise<WorkspaceCustomerPage> {
  const response = await api.get<WorkspaceCustomerPage>(`/workspaces/${workspaceId}/customers`, {
    params: { search: options.search || undefined, page: options.page ?? 1, per_page: options.perPage ?? 12 },
  });
  return response.data;
}

export async function getWorkspaceCustomerDetails(
  workspaceId: number,
  customerId: number,
  options: { page?: number; perPage?: number } = {},
): Promise<WorkspaceCustomerDetailsPage> {
  const response = await api.get<WorkspaceCustomerDetailsPage>(`/workspaces/${workspaceId}/customers/${customerId}`, {
    params: { page: options.page ?? 1, per_page: options.perPage ?? 10 },
  });
  return response.data;
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

export async function getMyBookingsPage(options: BookingListOptions): Promise<BookingListPage> {
  const response = await api.get<BookingListPage>("/my-bookings", {
    params: {
      tab: options.tab,
      status: options.status || undefined,
      payment_status: options.paymentStatus || undefined,
      payment_method: options.paymentMethod || undefined,
      from: options.from || undefined,
      to: options.to || undefined,
      search: options.search?.trim() || undefined,
      page: options.page ?? 1,
      per_page: options.perPage ?? 10,
    },
  });
  return response.data;
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

export async function recordCashReceived(
  workspaceId: number,
  bookingId: number,
  data: { amount: number; idempotency_key: string; cash_received_confirmed: true },
): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/bookings/${bookingId}/cash-received`, data);
}

export async function verifyCashEligibility(
  workspaceId: number,
  bookingId: number,
): Promise<{ amount_due: string; currency: string; booking_id: number; booking_status: string }> {
  const response = await api.get<{ cash: { amount_due: string; currency: string; booking_id: number; booking_status: string } }>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/cash-eligibility`,
  );
  return response.data.cash;
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

export async function cancelBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/cancel`,
  );

  return response.data.booking;
}

export async function rejectBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/reject`,
  );

  return response.data.booking;
}

export async function checkOutBooking(
  workspaceId: number,
  bookingId: number,
): Promise<Booking> {
  const response = await api.post<BookingResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/check-out`,
  );

  return response.data.booking;
}
