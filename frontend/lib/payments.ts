import api from "@/lib/api";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cash" | "bank_transfer";
export interface Payment {
  id: number; booking_id: number; amount: string | number; status: PaymentStatus;
  payment_method: PaymentMethod | string | null; transaction_reference: string | null;
  paid_at: string | null; payment_date: string | null; submitted_at: string | null;
  bank_name?: string | null; verified_by?: number | null; verifier_name?: string | null;
  verified_at?: string | null; rejection_reason?: string | null; receipt_number?: string | null;
  refunded_at?: string | null; refunded_by?: number | null; refund_reference?: string | null; refund_verifier_name?: string | null;
  proof_available?: boolean; receipt_available?: boolean; links?: { proof: string | null; receipt: string | null };
  booking?: { id: number; start_at: string; end_at: string; total_price?: string | number; payment_method?: string | null;
    status?: string;
    verified_amount?: number; outstanding_balance?: number; fully_paid?: boolean;
    customer?: { id: number; name: string; email: string } | null;
    workspace: { id: number; name: string } | null; resource: { id: number; name: string } | null } | null;
}
export interface PaymentSubmission { payment_method: "cash" | "bank_transfer"; amount: number; payment_date: string; bank_name?: string; transaction_reference?: string; proof?: File; }
export interface CashReconciliationCase {
  id: number; booking_id: number | null; amount: string | number | null; status: "open" | "resolved";
  reason: string; idempotency_key: string; created_at: string; staff_member?: { id: number; name: string } | null;
  resolved_at?: string | null; resolution_notes?: string | null;
}
interface Paginated<T> { data: T[]; meta?: { current_page: number; last_page: number; total: number }; }
interface PaymentsResponse { payments: Paginated<Payment> | Payment[]; counts?: Record<PaymentStatus, number>; }
interface PaymentResponse { message: string; payment: Payment; }
const unwrap = <T,>(value: Paginated<T> | T[]): T[] => Array.isArray(value) ? value : value.data;

export async function getPaymentsPage(workspaceId: number, params: { page?: number; per_page?: number; status?: string; method?: string; search?: string; from?: string; to?: string } = {}): Promise<{ data: Payment[]; page: number; lastPage: number; total: number; counts: Record<PaymentStatus, number> }> {
  const response = await api.get<PaymentsResponse>(`/workspaces/${workspaceId}/payments`, { params: { per_page: 25, ...params } });
  const page = Array.isArray(response.data.payments) ? undefined : response.data.payments;
  return { data: unwrap(response.data.payments), page: page?.meta?.current_page ?? 1, lastPage: page?.meta?.last_page ?? 1, total: page?.meta?.total ?? unwrap(response.data.payments).length, counts: response.data.counts ?? { pending: 0, paid: 0, failed: 0, refunded: 0 } };
}
export async function getPayments(workspaceId: number, params: { page?: number; per_page?: number; status?: string; method?: string; search?: string; from?: string; to?: string } = {}): Promise<Payment[]> {
  return (await getPaymentsPage(workspaceId, { per_page: 100, ...params })).data;
}
export async function createPayment(workspaceId: number, bookingId: number, data: PaymentSubmission): Promise<Payment> {
  const form = new FormData(); Object.entries(data).forEach(([key, value]) => { if (value !== undefined) form.append(key, value instanceof File ? value : String(value)); });
  const response = await api.post<PaymentResponse>(`/workspaces/${workspaceId}/bookings/${bookingId}/payment`, form);
  return response.data.payment;
}
export async function updatePayment(workspaceId: number, paymentId: number, data: Partial<PaymentSubmission>): Promise<Payment> {
  const form = new FormData(); Object.entries(data).forEach(([key, value]) => { if (value !== undefined) form.append(key, value instanceof File ? value : String(value)); }); form.append("_method", "PUT");
  const response = await api.post<PaymentResponse>(`/workspaces/${workspaceId}/payments/${paymentId}`, form); return response.data.payment;
}
export async function deletePayment(workspaceId: number, paymentId: number): Promise<void> { await api.delete(`/workspaces/${workspaceId}/payments/${paymentId}`); }
export async function reviewPayment(workspaceId: number, paymentId: number, approved: boolean, reason?: string): Promise<Payment> {
  const response = await api.post<PaymentResponse>(`/workspaces/${workspaceId}/payments/${paymentId}/${approved ? "paid" : "failed"}`, approved ? { verification_confirmed: true } : { reason }); return response.data.payment;
}
export async function refundPayment(workspaceId: number, paymentId: number, refundReference: string): Promise<Payment> { const r = await api.post<PaymentResponse>(`/workspaces/${workspaceId}/payments/${paymentId}/refund`, { refund_processed: true, refund_reference: refundReference }); return r.data.payment; }
export async function getCashReconciliationCases(workspaceId: number): Promise<CashReconciliationCase[]> {
  const r = await api.get<{ cases: Paginated<CashReconciliationCase> | CashReconciliationCase[] }>(`/workspaces/${workspaceId}/cash-reconciliations`);
  return unwrap(r.data.cases);
}
export async function resolveCashReconciliationCase(workspaceId: number, caseId: number, notes: string): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/cash-reconciliations/${caseId}/resolve`, { resolution_notes: notes });
}
export async function getMyPayments(): Promise<Payment[]> { const r = await api.get<PaymentsResponse>("/my-payments", { params: { per_page: 100 } }); return unwrap(r.data.payments); }
export async function paymentFile(url: string): Promise<Blob> { const r = await api.get(url, { responseType: "blob" }); return r.data as Blob; }
