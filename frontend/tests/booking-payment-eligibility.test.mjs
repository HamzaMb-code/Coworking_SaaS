import test from "node:test";
import assert from "node:assert/strict";
import { isWithinBookingPaymentDeadline } from "../lib/booking-payment-eligibility.js";

const now = Date.parse("2026-10-20T12:00:00Z");

test("expired pending holds cannot start a new payment", () => {
  assert.equal(isWithinBookingPaymentDeadline({
    status: "pending",
    payment_deadline_at: "2026-10-20T11:59:00Z",
  }, now), false);
});

test("confirmed bookings remain eligible after the original hold deadline", () => {
  assert.equal(isWithinBookingPaymentDeadline({
    status: "confirmed",
    payment_deadline_at: "2026-10-20T11:59:00Z",
  }, now), true);
});

test("pending bookings remain eligible until their deadline", () => {
  assert.equal(isWithinBookingPaymentDeadline({
    status: "pending",
    payment_deadline_at: "2026-10-20T12:01:00Z",
  }, now), true);
});
