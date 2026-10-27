<?php

namespace App\Services;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\CashPaymentReconciliationCase;
use App\Models\Payment;
use App\Models\Resource;
use App\PaymentStatus;
use App\ResourceStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    public function createSubmission(Booking $booking, array $data, ?string $proofPath): Payment
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($booking);
        return DB::transaction(function () use ($booking, $data, $proofPath): Payment {
            $lockedBooking = $this->lockBookingAndResource($booking->id);
            $this->assertBookingCanReceivePayment($lockedBooking);
            $this->assertNewPaymentWithinDeadline($lockedBooking);
            if ($lockedBooking->payment_method !== null && $lockedBooking->payment_method !== $data['payment_method']) {
                throw ValidationException::withMessages(['payment_method' => 'This booking is reserved for '.str_replace('_', ' ', $lockedBooking->payment_method).'. The payment method cannot be changed after booking.']);
            }
            $summary = $this->lockedPaymentSummary($lockedBooking);
            $amount = round((float) $data['amount'], 2);

            if ($summary['pending_amount'] > 0) {
                throw ValidationException::withMessages(['booking' => 'A payment declaration is already awaiting review. Wait for its decision before submitting another.']);
            }
            if ($amount <= 0 || abs($amount - $summary['outstanding_balance']) > 0.0001) {
                throw ValidationException::withMessages(['amount' => 'Declare the full remaining balance of '.number_format($summary['outstanding_balance'], 2).' MAD. Partial transfer declarations are not accepted.']);
            }
            if ($data['payment_method'] === 'bank_transfer' && !$proofPath) {
                throw ValidationException::withMessages(['proof' => 'Upload proof of the bank transfer.']);
            }

            return $lockedBooking->payments()->create([
                'amount' => $amount,
                'status' => PaymentStatus::PENDING,
                'payment_method' => $data['payment_method'],
                'payment_date' => $data['payment_date'],
                'submitted_at' => now(),
                'bank_name' => $data['payment_method'] === 'bank_transfer' ? ($data['bank_name'] ?? null) : null,
                'transaction_reference' => $data['payment_method'] === 'bank_transfer' ? ($data['transaction_reference'] ?? null) : null,
                'proof_path' => $proofPath,
                // CASH submissions remain pending until a workspace member verifies receipt.
                'verified_by' => null,
                'verified_at' => null,
            ]);
        });
    }

    public function updateSubmission(Payment $payment, array $data, ?string $newProofPath = null): Payment
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($payment->booking_id);
        return DB::transaction(function () use ($payment, $data, $newProofPath): Payment {
            $booking = $this->lockBookingAndResource($payment->booking_id);
            app(BookingService::class)->expireLockedBookingIfDue($booking);
            $booking->refresh();
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($lockedPayment->status !== PaymentStatus::PENDING || $lockedPayment->verified_by !== null) {
                throw ValidationException::withMessages(['payment' => 'Only unreviewed pending submissions can be edited.']);
            }
            if ($lockedPayment->payment_method !== 'bank_transfer') {
                throw ValidationException::withMessages(['payment' => 'Only bank transfer declarations can be edited by the customer.']);
            }
            if (!in_array($booking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)
                || $booking->end_at->lessThanOrEqualTo(now())
                || ($booking->status === BookingStatus::PENDING && $booking->start_at->lessThanOrEqualTo(now()))) {
                throw ValidationException::withMessages(['booking' => 'This booking can no longer accept payment submissions.']);
            }

            $summary = $this->lockedPaymentSummary($booking);
            $otherPending = $booking->getRelation('payments')->contains(
                fn (Payment $candidate): bool => $candidate->id !== $lockedPayment->id && $candidate->status === PaymentStatus::PENDING
            );
            if ($otherPending) {
                throw ValidationException::withMessages(['booking' => 'Another payment declaration is awaiting review. Resolve it before editing this one.']);
            }
            $amount = round((float) ($data['amount'] ?? $lockedPayment->amount), 2);
            if ($amount <= 0 || abs($amount - $summary['outstanding_balance']) > 0.0001) {
                throw ValidationException::withMessages(['amount' => 'The declaration must cover the full remaining balance of '.number_format($summary['outstanding_balance'], 2).' MAD.']);
            }
            $method = $data['payment_method'] ?? $lockedPayment->payment_method;
            $proofPath = $method === 'bank_transfer' ? ($newProofPath ?? $lockedPayment->proof_path) : null;
            if ($method === 'bank_transfer' && !$proofPath) {
                throw ValidationException::withMessages(['proof' => 'Upload proof of the bank transfer.']);
            }

            $lockedPayment->update([
                'amount' => $amount,
                'payment_method' => $method,
                'payment_date' => $data['payment_date'] ?? $lockedPayment->payment_date,
                'bank_name' => $method === 'bank_transfer' ? ($data['bank_name'] ?? $lockedPayment->bank_name) : null,
                'transaction_reference' => $method === 'bank_transfer' ? ($data['transaction_reference'] ?? $lockedPayment->transaction_reference) : null,
                'proof_path' => $proofPath,
            ]);

            return $lockedPayment->fresh();
        });
    }

    public function deleteSubmission(Payment $payment): void
    {
        $proofPath = DB::transaction(function () use ($payment): ?string {
            $booking = $this->lockBookingAndResource($payment->booking_id);
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($lockedPayment->status !== PaymentStatus::PENDING || $lockedPayment->verified_by !== null) {
                throw ValidationException::withMessages(['payment' => 'Only unreviewed pending submissions can be deleted.']);
            }
            if ($lockedPayment->payment_method !== 'bank_transfer') {
                throw ValidationException::withMessages(['payment' => 'Only bank transfer declarations can be deleted by the customer.']);
            }
            $proofPath = $lockedPayment->proof_path;
            $lockedPayment->delete();
            app(BookingService::class)->expireLockedBookingIfDue($booking);
            return $proofPath;
        });
        if ($proofPath && !Storage::disk('local')->delete($proofPath)) {
            Log::warning('Deleted bank-transfer declaration proof could not be removed from private storage.', ['payment_proof_path' => $proofPath]);
        }
    }

    /** @return array{payment: Payment, approved: bool, was_fully_paid: bool, booking_status_before: BookingStatus} */
    public function markAsPaid(Payment $payment, ?int $verifiedBy = null): array
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($payment->booking_id);
        $result = DB::transaction(function () use ($payment, $verifiedBy): array {
            $booking = $this->lockBookingAndResource($payment->booking_id);
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($lockedPayment->payment_method !== 'bank_transfer') {
                $message = $lockedPayment->payment_method === 'cash'
                    ? 'Cash must be recorded through the full-amount reception workflow.'
                    : 'Card payments can only be verified by the signed payment provider.';
                throw ValidationException::withMessages(['status' => $message]);
            }
            if ($booking->payment_method !== null && $booking->payment_method !== 'bank_transfer') {
                throw ValidationException::withMessages(['payment_method' => 'This booking was reserved for cash. The bank-transfer declaration cannot be approved.']);
            }
            if ($lockedPayment->status === PaymentStatus::PAID) {
                return [
                    'payment' => $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier']),
                    'approved' => false,
                    'was_fully_paid' => true,
                    'booking_status_before' => $booking->status,
                ];
            }
            if ($lockedPayment->status !== PaymentStatus::PENDING) {
                throw ValidationException::withMessages(['status' => 'Only pending submissions can be approved.']);
            }
            $this->assertBookingCanReceivePayment($booking);
            // This locking read refreshes resource status after waiting on the
            // resource mutex instead of using an older repeatable-read snapshot.
            $resource = Resource::query()->lockForUpdate()->findOrFail($booking->resource_id);
            $this->assertBankTransferResourceEligible($booking, $resource);
            $summary = $this->lockedPaymentSummary($booking);
            $otherPending = $booking->getRelation('payments')->contains(
                fn (Payment $candidate): bool => $candidate->id !== $lockedPayment->id && $candidate->status === PaymentStatus::PENDING
            );
            if ($otherPending) {
                throw ValidationException::withMessages(['booking' => 'Another payment is awaiting review. Resolve it before approving this transfer.']);
            }
            if (abs((float) $lockedPayment->amount - $summary['outstanding_balance']) > 0.0001) {
                throw ValidationException::withMessages(['amount' => 'Approval requires verified transfer of the full remaining balance: '.number_format($summary['outstanding_balance'], 2).' MAD. Reject or correct this declaration.']);
            }

            $wasFullyPaid = $summary['fully_paid'];
            $bookingStatusBefore = $booking->status;
            $verifiedAt = now();
            $lockedPayment->update([
                'status' => PaymentStatus::PAID,
                'verified_by' => $verifiedBy,
                'verified_at' => $verifiedAt,
                'paid_at' => $verifiedAt,
                'rejection_reason' => null,
            ]);
            $lockedPayment->refresh();
            if ($booking->status === BookingStatus::PENDING) {
                $booking->unsetRelation('payments');
                if ($this->summary($booking)['fully_paid']) {
                    app(BookingService::class)->confirm($booking, $verifiedBy);
                } else {
                    throw ValidationException::withMessages(['payment' => 'A bank-transfer approval must cover the full balance before this booking can be confirmed.']);
                }
            }

            return [
                'payment' => $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier']),
                'approved' => true,
                'was_fully_paid' => $wasFullyPaid,
                'booking_status_before' => $bookingStatusBefore,
            ];
        });

        $result['payment'] = $this->issueReceiptIfMissing($result['payment']);
        return $result;
    }

    /** Return the amount that must be physically received before the cash-record request. */
    public function cashEligibility(Booking $booking): array
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($booking);

        return DB::transaction(function () use ($booking): array {
            $lockedBooking = $this->lockBookingAndResource($booking->id);
            if ($lockedBooking->payment_method !== null && $lockedBooking->payment_method !== 'cash') {
                throw ValidationException::withMessages(['payment_method' => 'This booking was reserved for bank transfer. Do not accept cash; ask the customer to follow the saved payment method.']);
            }
            $resource = Resource::query()->findOrFail($lockedBooking->resource_id);
            $summary = $this->assertCashBookingEligible($lockedBooking, $resource);
            return [
                'amount_due' => number_format($summary['outstanding_balance'], 2, '.', ''),
                'currency' => 'MAD',
                'booking_id' => $lockedBooking->id,
                'booking_status' => $lockedBooking->status->value,
            ];
        });
    }

    /** @return array{payment: Payment, created: bool} */
    public function recordCashReceived(Booking $booking, array $data, int $receivedBy): array
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($booking);
        $result = DB::transaction(function () use ($booking, $data, $receivedBy): array {
            $lockedBooking = $this->lockBookingAndResource($booking->id);
            if ($lockedBooking->payment_method !== null && $lockedBooking->payment_method !== 'cash') {
                throw ValidationException::withMessages(['payment_method' => 'This booking was reserved for bank transfer. Do not accept cash; ask the customer to follow the saved payment method.']);
            }
            $amount = round((float) $data['amount'], 2);
            $idempotentPayment = Payment::query()->where('idempotency_key', $data['idempotency_key'])->lockForUpdate()->first();
            if ($idempotentPayment) {
                if ($idempotentPayment->booking_id !== $lockedBooking->id
                    || $idempotentPayment->payment_method !== 'cash'
                    || round((float) $idempotentPayment->amount, 2) !== $amount) {
                    throw ValidationException::withMessages(['idempotency_key' => 'This cash receipt request key was already used for a different payment.']);
                }
                $this->resolveMatchingCashReconciliation($lockedBooking, (string) $data['idempotency_key'], $idempotentPayment->id, $receivedBy);
                return ['payment' => $idempotentPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'booking.payments', 'verifier']), 'created' => false];
            }

            $resource = Resource::query()->findOrFail($lockedBooking->resource_id);
            $summary = $this->assertCashBookingEligible($lockedBooking, $resource);
            $due = round($summary['outstanding_balance'], 2);
            if (abs($amount - $due) > 0.0001) {
                throw ValidationException::withMessages(['amount' => 'Receive the full amount due of '.number_format($due, 2).' MAD. Partial cash payments are not accepted.']);
            }

            $receivedAt = now();
            $payment = $lockedBooking->payments()->create([
                'amount' => $amount,
                'status' => PaymentStatus::PAID,
                'payment_method' => 'cash',
                'idempotency_key' => $data['idempotency_key'],
                'payment_date' => $receivedAt->toDateString(),
                'submitted_at' => now(),
                'paid_at' => $receivedAt,
                'verified_by' => $receivedBy,
                'verified_at' => now(),
            ]);

            if ($lockedBooking->status === BookingStatus::PENDING) {
                $lockedBooking->unsetRelation('payments');
                if ($this->summary($lockedBooking)['fully_paid']) {
                    app(BookingService::class)->confirm($lockedBooking, $receivedBy);
                }
            }
            $this->resolveMatchingCashReconciliation($lockedBooking, (string) $data['idempotency_key'], $payment->id, $receivedBy);

            return ['payment' => $payment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'booking.payments', 'verifier']), 'created' => true];
        }, attempts: 3);

        // Receipt storage is post-commit: a filesystem failure cannot roll back
        // or hide the durable full-cash payment and its booking confirmation.
        $result['payment'] = $this->issueReceiptIfMissing($result['payment']);

        return ['payment' => $result['payment']->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'booking.payments', 'verifier']), 'created' => $result['created']];
    }

    public function markAsFailed(Payment $payment, string $reason, int $reviewedBy): Payment
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($payment->booking_id);
        return DB::transaction(function () use ($payment, $reason, $reviewedBy): Payment {
            $booking = $this->lockBookingAndResource($payment->booking_id);
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if (!in_array($lockedPayment->payment_method, ['cash', 'bank_transfer'], true)) {
                throw ValidationException::withMessages(['status' => 'Card failures must be confirmed by the payment provider.']);
            }
            if ($lockedPayment->status !== PaymentStatus::PENDING) {
                throw ValidationException::withMessages(['status' => 'Only pending submissions can be rejected.']);
            }
            $lockedPayment->update([
                'status' => PaymentStatus::FAILED,
                'verified_by' => $reviewedBy,
                'verified_at' => now(),
                'rejection_reason' => $reason,
            ]);
            app(BookingService::class)->expireLockedBookingIfDue($booking);

            return $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier']);
        });
    }

    public function applyProviderResult(Payment $payment, string $status, string $transactionReference): Payment
    {
        app(BookingService::class)->expireIfPaymentDeadlinePassed($payment->booking_id);
        $result = DB::transaction(function () use ($payment, $status, $transactionReference): Payment {
            $booking = $this->lockBookingAndResource($payment->booking_id);
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
            if ($targetStatus === PaymentStatus::PAID && (!in_array($booking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)
                || ($booking->status === BookingStatus::PENDING && $booking->start_at->lessThanOrEqualTo(now()))
                || ($booking->status !== BookingStatus::PENDING && $booking->end_at->lessThanOrEqualTo(now()))
                || ($booking->status === BookingStatus::PENDING && $booking->payment_deadline_at && $booking->payment_deadline_at->lessThanOrEqualTo(now()) && !$this->hasPendingBankTransferReview($booking)))) {
                throw ValidationException::withMessages(['booking' => 'This booking is not eligible to receive verified payment.']);
            }
            $lockedPayment->update([
                'status' => $targetStatus,
                'transaction_reference' => $transactionReference,
                'paid_at' => $targetStatus === PaymentStatus::PAID ? now() : null,
                'verified_at' => $targetStatus === PaymentStatus::PAID ? now() : null,
            ]);
            if ($targetStatus === PaymentStatus::PAID) {
                $lockedPayment->refresh();
                if ($booking->status === BookingStatus::PENDING) {
                    $booking->unsetRelation('payments');
                    if ($this->summary($booking)['fully_paid']) {
                        app(BookingService::class)->confirm($booking, null, 'payment_provider_webhook');
                    }
                }
            }

            return $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier']);
        });
        return $result->status === PaymentStatus::PAID ? $this->issueReceiptIfMissing($result) : $result;
    }

    /** Record a refund that the owner has already processed outside this application. */
    public function refund(Payment $payment, int $refundedBy, string $refundReference): array
    {
        return DB::transaction(function () use ($payment, $refundedBy, $refundReference): array {
            $this->lockBookingAndResource($payment->booking_id);
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($lockedPayment->status === PaymentStatus::REFUNDED) {
                return ['payment' => $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier', 'refundVerifier']), 'recorded' => false];
            }
            if ($lockedPayment->status !== PaymentStatus::PAID) {
                throw ValidationException::withMessages(['status' => 'Only recorded paid payments can have an externally processed refund recorded.']);
            }
            $lockedPayment->update([
                'status' => PaymentStatus::REFUNDED,
                'refunded_by' => $refundedBy,
                'refunded_at' => now(),
                'refund_reference' => $refundReference,
            ]);
            $lockedPayment->refresh();
            $lockedPayment->booking->lifecycleEvents()->create([
                'actor_id' => $refundedBy,
                'event' => 'refund_recorded',
                'details' => ['payment_id' => $lockedPayment->id, 'refund_reference' => $refundReference],
                'occurred_at' => $lockedPayment->refunded_at,
            ]);
            return ['payment' => $lockedPayment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier', 'refundVerifier']), 'recorded' => true];
        });
    }

    /** @return array{verified_amount: float, outstanding_balance: float, pending_amount: float, fully_paid: bool} */
    public function summary(Booking $booking): array
    {
        $payments = $booking->relationLoaded('payments') ? $booking->getRelation('payments') : $booking->payments()->get();
        $verified = round((float) $payments->where('status', PaymentStatus::PAID)->sum('amount'), 2);
        $pending = round((float) $payments->where('status', PaymentStatus::PENDING)->sum('amount'), 2);
        $total = round((float) $booking->total_price, 2);
        $balance = round(max(0, $total - $verified), 2);
        $eligibleStatus = !in_array($booking->status, [BookingStatus::CANCELLED, BookingStatus::REJECTED, BookingStatus::NO_SHOW], true);

        return [
            'verified_amount' => $verified,
            'outstanding_balance' => $balance,
            'pending_amount' => $pending,
            'fully_paid' => $eligibleStatus && $balance <= 0,
        ];
    }

    public function isEligibleForAccess(Booking $booking): bool
    {
        return $this->summary($booking)['fully_paid'];
    }

    private function assertBookingCanReceivePayment(Booking $booking): void
    {
        if (!in_array($booking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)) {
            throw ValidationException::withMessages(['booking' => 'Payment is available only for pending or confirmed bookings.']);
        }
        if ($booking->end_at->lessThanOrEqualTo(now())
            || ($booking->status === BookingStatus::PENDING && $booking->start_at->lessThanOrEqualTo(now()))) {
            throw ValidationException::withMessages(['booking' => 'The booking period has started or expired. Contact the workspace to reconcile payment.']);
        }
        if ($booking->status === BookingStatus::PENDING && $booking->payment_deadline_at
            && $booking->payment_deadline_at->lessThanOrEqualTo(now())
            && !$this->hasPendingBankTransferReview($booking)) {
            throw ValidationException::withMessages(['booking' => 'The payment deadline has passed. Create a new booking to continue.']);
        }
    }

    private function assertCashBookingEligible(Booking $booking, Resource $resource): array
    {
        $this->assertBookingCanReceivePayment($booking);
        if ($resource->status !== \App\ResourceStatus::ACTIVE) {
            throw ValidationException::withMessages(['resource' => 'This resource is unavailable. Do not accept cash for this booking.']);
        }
        $overlappingBookings = Booking::query()->where('resource_id', $resource->id)
            ->where('id', '!=', $booking->id)
            ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
            ->where('start_at', '<', $booking->end_at)
            ->where('end_at', '>', $booking->start_at)
            ->lockForUpdate()
            ->get();
        $overlap = $overlappingBookings->contains(function (Booking $candidate): bool {
            if ($candidate->status !== BookingStatus::PENDING
                || !$candidate->payment_deadline_at
                || $candidate->payment_deadline_at->isFuture()) {
                return true;
            }

            // This is also a locking read so a pending declaration committed
            // before the resource lock was acquired remains a reservation.
            return $candidate->payments()->where('status', PaymentStatus::PENDING)
                ->where('payment_method', 'bank_transfer')->lockForUpdate()->exists();
        });
        if ($overlap) {
            throw ValidationException::withMessages(['booking' => 'This booking no longer secures the resource time slot. Do not accept cash.']);
        }
        // Use a current/locking read because a transaction can wait for the
        // resource lock while its repeatable-read snapshot is already stale.
        $summary = $this->cashPaymentSummary($booking);
        if ($summary['outstanding_balance'] <= 0) {
            throw ValidationException::withMessages(['booking' => 'This booking has no balance due. Do not accept cash.']);
        }
        if ($summary['pending_amount'] > 0) {
            throw ValidationException::withMessages(['booking' => 'A payment is awaiting review. Resolve that payment before accepting cash.']);
        }
        if ($booking->getRelation('payments')->contains(fn (Payment $payment): bool => $payment->payment_method === 'cash' && $payment->status === PaymentStatus::PAID)) {
            throw ValidationException::withMessages(['booking' => 'A successful cash payment is already recorded for this booking.']);
        }

        return $summary;
    }

    /** @return array{verified_amount: float, outstanding_balance: float, pending_amount: float, fully_paid: bool} */
    private function cashPaymentSummary(Booking $booking): array
    {
        return $this->lockedPaymentSummary($booking);
    }

    /** @return array{verified_amount: float, outstanding_balance: float, pending_amount: float, fully_paid: bool} */
    private function lockedPaymentSummary(Booking $booking): array
    {
        $booking->setRelation('payments', $booking->payments()->lockForUpdate()->get());
        return $this->summary($booking);
    }

    private function assertBankTransferResourceEligible(Booking $booking, Resource $resource): void
    {
        if ($resource->workspace_id !== $booking->workspace_id || $resource->status !== ResourceStatus::ACTIVE) {
            throw ValidationException::withMessages(['resource' => 'This resource is unavailable. The declaration remains pending; do not approve it.']);
        }

        $overlap = Booking::query()->where('resource_id', $resource->id)
            ->where('id', '!=', $booking->id)
            ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
            ->where('start_at', '<', $booking->end_at)
            ->where('end_at', '>', $booking->start_at)
            ->where(function ($query): void {
                $query->where('status', '!=', BookingStatus::PENDING)
                    ->orWhereNull('payment_deadline_at')
                    ->orWhere('payment_deadline_at', '>', now())
                    ->orWhereHas('payments', fn ($payments) => $payments->where('status', PaymentStatus::PENDING)->where('payment_method', 'bank_transfer'));
            })
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['booking' => 'This booking no longer secures the resource time slot. The declaration remains pending; do not approve it.']);
        }
    }

    private function issueReceiptIfMissing(Payment $payment): Payment
    {
        try {
            // Receipt generation runs after payment approval commits, in its own
            // transaction. This keeps a storage outage from undoing the payment,
            // while the payment row lock prevents duplicate receipts on retries.
            DB::transaction(function () use ($payment): void {
                $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
                if (!in_array($lockedPayment->status, [PaymentStatus::PAID, PaymentStatus::REFUNDED], true) || $lockedPayment->receipt_path) {
                    return;
                }

                $receipt = app(PaymentReceiptService::class)->issue($lockedPayment);
                $lockedPayment->update(['receipt_number' => $receipt['number'], 'receipt_path' => $receipt['path']]);
            });
        } catch (\Throwable $exception) {
            Log::error('A recorded payment exists but receipt generation failed.', [
                'payment_id' => $payment->id,
                'booking_id' => $payment->booking_id,
                'exception' => $exception::class,
            ]);
        }

        return $payment->fresh(['booking.user', 'booking.workspace', 'booking.resource', 'verifier']);
    }

    private function resolveMatchingCashReconciliation(Booking $booking, string $idempotencyKey, int $paymentId, int $resolvedBy): void
    {
        $case = CashPaymentReconciliationCase::query()
            ->where('booking_id', $booking->id)
            ->where('idempotency_key', $idempotencyKey)
            ->where('status', 'open')
            ->lockForUpdate()->first();
        if (!$case) return;
        $case->update([
            'status' => 'resolved',
            'resolved_by' => $resolvedBy,
            'resolved_at' => now(),
            'resolution_notes' => 'Cash payment #'.$paymentId.' was successfully recorded using the original request key.',
        ]);
    }

    private function assertNewPaymentWithinDeadline(Booking $booking): void
    {
        if ($booking->status === BookingStatus::PENDING && $booking->payment_deadline_at
            && $booking->payment_deadline_at->lessThanOrEqualTo(now())) {
            throw ValidationException::withMessages(['booking' => 'The payment deadline has passed. Create a new booking to continue.']);
        }
    }

    private function hasPendingBankTransferReview(Booking $booking): bool
    {
        return app(BookingService::class)->hasPendingBankTransferReview($booking);
    }

    /** Lock order is resource first, then booking, then payment. */
    private function lockBookingAndResource(Booking|int $booking): Booking
    {
        $bookingId = $booking instanceof Booking ? $booking->id : $booking;
        $resourceId = Booking::query()->whereKey($bookingId)->value('resource_id');
        if (!$resourceId) {
            throw ValidationException::withMessages(['booking' => 'The booking resource no longer exists.']);
        }

        Resource::query()->lockForUpdate()->findOrFail($resourceId);
        $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($bookingId);
        if ((int) $lockedBooking->resource_id !== (int) $resourceId) {
            // Do not retry while retaining the old resource lock: booking updates
            // acquire multiple resources in sorted order, so retrying here could
            // invert that order. The enclosing transaction releases this lock.
            throw ValidationException::withMessages(['booking' => 'The booking resource changed while it was being processed. Please retry.']);
        }

        return $lockedBooking;
    }
}
