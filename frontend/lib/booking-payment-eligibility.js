/**
 * @param {{ status: string; payment_deadline_at?: string | null }} booking
 * @param {number} [now]
 */
export function isWithinBookingPaymentDeadline(booking, now = Date.now()) {
  return booking.status !== "pending"
    || !booking.payment_deadline_at
    || Date.parse(booking.payment_deadline_at) > now;
}
