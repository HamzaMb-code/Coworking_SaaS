<?php

namespace App\Services;

use App\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function create(
        Booking $booking,
        ?string $paymentMethod = null
    ): Payment {
        return DB::transaction(function () use ($booking, $paymentMethod) {
            $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);

            if ($lockedBooking->status === \App\BookingStatus::CANCELLED) {
                throw ValidationException::withMessages(['booking' => 'A cancelled booking cannot be paid.']);
            }

            if ($lockedBooking->status !== \App\BookingStatus::CONFIRMED) {
                throw ValidationException::withMessages(['booking' => 'Payment is available after the workspace confirms your booking.']);
            }

            $existing = Payment::query()->where('booking_id', $lockedBooking->id)->lockForUpdate()->first();
            if ($existing) {
                if ($paymentMethod === 'cash' && in_array($existing->status, [PaymentStatus::PENDING, PaymentStatus::FAILED], true)) {
                    $existing->update([
                        'amount' => $lockedBooking->total_price,
                        'status' => PaymentStatus::PAID,
                        'payment_method' => 'cash',
                        'paid_at' => now(),
                    ]);

                    return $existing->fresh();
                }
                if ($existing->status === PaymentStatus::PENDING) {
                    if ((float) $existing->amount !== (float) $lockedBooking->total_price) {
                        $existing->update(['amount' => $lockedBooking->total_price]);
                    }
                    return $existing;
                }
                if ($existing->status === PaymentStatus::FAILED) {
                    $existing->update([
                        'amount' => $lockedBooking->total_price,
                        'status' => PaymentStatus::PENDING,
                        'payment_method' => $paymentMethod ?? $existing->payment_method,
                    ]);
                    return $existing->fresh();
                }
                throw ValidationException::withMessages(['booking' => 'This booking already has a completed or refunded payment.']);
            }

            return Payment::create([
                'booking_id' => $lockedBooking->id,
                'amount' => $lockedBooking->total_price,
                'status' => $paymentMethod === 'cash' ? PaymentStatus::PAID : PaymentStatus::PENDING,
                'payment_method' => $paymentMethod,
                'paid_at' => $paymentMethod === 'cash' ? now() : null,
            ]);
        });
    }

    public function markAsPaid(
        Payment $payment,
        ?string $transactionReference = null
    ): Payment {
        // Provider integrations must call this after validating a signed webhook;
        // a customer-facing success redirect is never proof of payment.
        if ($payment->status !== PaymentStatus::PENDING) {
            throw ValidationException::withMessages([
                'status' => 'Only pending payments can be marked as paid.',
            ]);
        }

        if ($payment->payment_method !== 'cash') {
            throw ValidationException::withMessages([
                'status' => 'Online payments can only be marked paid after provider verification.',
            ]);
        }

        $payment->update([
            'status' => PaymentStatus::PAID,
            'transaction_reference' => $transactionReference,
            'paid_at' => now(),
        ]);

        return $payment->fresh();
    }

    public function markAsFailed(Payment $payment): Payment
    {
        if ($payment->status !== PaymentStatus::PENDING) {
            throw ValidationException::withMessages([
                'status' => 'Only pending payments can be marked as failed.',
            ]);
        }

        if ($payment->payment_method === 'card') {
            throw ValidationException::withMessages([
                'status' => 'Online payment failures must be confirmed by the payment provider.',
            ]);
        }

        $payment->update([
            'status' => PaymentStatus::FAILED,
        ]);

        return $payment->fresh();
    }

    public function applyProviderResult(Payment $payment, string $status, string $transactionReference): Payment
    {
        return DB::transaction(function () use ($payment, $status, $transactionReference) {
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($lockedPayment->payment_method !== 'card') {
                throw ValidationException::withMessages(['payment' => 'Provider updates are valid only for card payments.']);
            }

            $targetStatus = $status === 'paid' ? PaymentStatus::PAID : PaymentStatus::FAILED;
            if ($lockedPayment->status === $targetStatus) {
                return $lockedPayment;
            }
            if ($lockedPayment->status !== PaymentStatus::PENDING) {
                throw ValidationException::withMessages(['payment' => 'This payment can no longer be updated.']);
            }

            $lockedPayment->update([
                'status' => $targetStatus,
                'transaction_reference' => $transactionReference,
                'paid_at' => $targetStatus === PaymentStatus::PAID ? now() : null,
            ]);

            return $lockedPayment->fresh();
        });
    }

    public function refund(Payment $payment): Payment
    {
        if ($payment->status !== PaymentStatus::PAID) {
            throw ValidationException::withMessages([
                'status' => 'Only paid payments can be refunded.',
            ]);
        }

        $payment->update([
            'status' => PaymentStatus::REFUNDED,
        ]);

        return $payment->fresh();
    }
}
