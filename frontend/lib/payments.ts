import api from "@/lib/api";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type PaymentMethod = "card" | "cash";

export interface Payment {
  id: number;
  booking_id: number;
  amount: string | number;
  status: PaymentStatus;
  payment_method: string | null;
  transaction_reference: string | null;
  paid_at: string | null;
  booking?: {
    id: number;
    start_at: string;
    end_at: string;
    customer?: { id: number; name: string; email: string } | null;
    workspace: { id: number; name: string } | null;
    resource: { id: number; name: string } | null;
  } | null;
}

export interface CreatePaymentData {
  payment_method: PaymentMethod;
}

interface PaymentsResponse {
  payments: Payment[];
}

interface PaymentResponse {
  message: string;
  payment: Payment;
}

export async function getPayments(
  workspaceId: number,
): Promise<Payment[]> {
  const response = await api.get<PaymentsResponse>(
    `/workspaces/${workspaceId}/payments`,
  );

  return response.data.payments;
}

export async function createPayment(
  workspaceId: number,
  bookingId: number,
  data: CreatePaymentData,
): Promise<Payment> {
  const response = await api.post<PaymentResponse>(
    `/workspaces/${workspaceId}/bookings/${bookingId}/payment`,
    data,
  );

  return response.data.payment;
}

export async function markPaymentAsPaid(
  workspaceId: number,
  paymentId: number,
): Promise<Payment> {
  const response = await api.post<PaymentResponse>(
    `/workspaces/${workspaceId}/payments/${paymentId}/paid`,
  );

  return response.data.payment;
}

export async function markPaymentAsFailed(
  workspaceId: number,
  paymentId: number,
): Promise<Payment> {
  const response = await api.post<PaymentResponse>(
    `/workspaces/${workspaceId}/payments/${paymentId}/failed`,
  );

  return response.data.payment;
}

export async function refundPayment(
  workspaceId: number,
  paymentId: number,
): Promise<Payment> {
  const response = await api.post<PaymentResponse>(
    `/workspaces/${workspaceId}/payments/${paymentId}/refund`,
  );

  return response.data.payment;
}

export async function getMyPayments(): Promise<Payment[]> {
  const response = await api.get<PaymentsResponse>("/my-payments");
  return response.data.payments;
}
