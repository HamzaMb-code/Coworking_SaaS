<?php

namespace App\Services;

use App\PaymentStatus;
use App\PricingUnit;
use App\BookingStatus;
use App\WorkspaceMemberRole;
use App\Mail\BookingRequestMail;
use App\Models\Booking;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\ResourceStatus;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Throwable;

class BookingService
{
    private const PAYMENT_HOLD_MINUTES = 15;

    public function create(
        User $user,
        Workspace $workspace,
        array $data
    ): Booking {
        $booking = DB::transaction(function () use ($user, $workspace, $data) {
            $quote = $this->quote($workspace, $data, lockResource: true);

            return Booking::create([
                'user_id' => $user->id,
                'workspace_id' => $workspace->id,
                'resource_id' => $quote['resource']->id,
                'start_at' => $quote['start_at'],
                'end_at' => $quote['end_at'],
                'total_price' => $quote['total_price'],
                'payment_method' => $data['payment_method'],
                'status' => BookingStatus::PENDING,
                'payment_deadline_at' => now()->addMinutes(self::PAYMENT_HOLD_MINUTES),
            ]);
        });

        $booking->load(['user', 'resource', 'workspace']);
        $ownerEmails = $workspace->members()
            ->where('role', WorkspaceMemberRole::OWNER)
            ->with('user:id,email')
            ->get()
            ->pluck('user.email')
            ->filter()
            ->unique();

        foreach ($ownerEmails as $email) {
            try {
                Mail::to($email)->send(new BookingRequestMail($booking));
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $booking;
    }

    /** @return array{resource: Resource, start_at: Carbon, end_at: Carbon, total_price: float} */
    public function quote(Workspace $workspace, array $data, bool $lockResource = false): array
    {
        return DB::transaction(function () use ($workspace, $data): array {
            $resource = Resource::query()->where('workspace_id', $workspace->id)
                ->whereKey($data['resource_id'])->lockForUpdate()->firstOrFail();
            if ($resource->status !== ResourceStatus::ACTIVE) {
                throw ValidationException::withMessages(['resource_id' => 'This resource is not available for booking.']);
            }

            $this->expireExpiredHoldsForLockedResource($resource->id);
            $start = Carbon::parse($data['start_at']);
            $end = Carbon::parse($data['end_at']);
            if ($start->lessThanOrEqualTo(now())) {
                throw ValidationException::withMessages(['start_at' => 'The start time must be in the future.']);
            }
            if ($end->lessThanOrEqualTo($start)) {
                throw ValidationException::withMessages(['end_at' => 'The end time must be after the start time.']);
            }

            $overlapExists = Booking::query()->where('resource_id', $resource->id)
                ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
                ->where('start_at', '<', $end)->where('end_at', '>', $start)->exists();
            if ($overlapExists) {
                throw ValidationException::withMessages(['start_at' => 'This resource is already booked during the selected period.']);
            }

            return ['resource' => $resource, 'start_at' => $start, 'end_at' => $end,
                'total_price' => $this->calculatePrice($resource, $start, $end)];
        }, attempts: 3);
    }


    public function update(
        User $user,
        Booking $booking,
        array $data
    ): Booking {
        $this->expireIfPaymentDeadlinePassed($booking);
        $resourceId = (int) ($data['resource_id'] ?? $booking->resource_id);
        $resourceIds = array_values(array_unique([$booking->resource_id, $resourceId]));
        sort($resourceIds);

        return DB::transaction(function () use ($user, $booking, $data, $resourceId, $resourceIds): Booking {
            $resources = Resource::query()->whereIn('id', $resourceIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);

            if ($lockedBooking->resource_id !== $booking->resource_id || !in_array($lockedBooking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)) {
                throw ValidationException::withMessages(['booking' => 'This booking can no longer be changed. Create a new booking instead.']);
            }
            if ($lockedBooking->payment_deadline_at && $lockedBooking->payment_deadline_at->lessThanOrEqualTo(now())
                && !$this->hasPendingBankTransferReview($lockedBooking)) {
                throw ValidationException::withMessages(['booking' => 'The payment deadline has passed. Create a new booking instead.']);
            }

            $resource = $resources->get($resourceId);
            if (!$resource || $resource->workspace_id !== $lockedBooking->workspace_id) {
                throw ValidationException::withMessages(['resource_id' => 'The selected resource does not belong to this workspace.']);
            }
            if ($resource->status !== ResourceStatus::ACTIVE) {
                throw ValidationException::withMessages(['resource_id' => 'This resource is not available for booking.']);
            }

            $start = isset($data['start_at']) ? Carbon::parse($data['start_at']) : $lockedBooking->start_at->copy();
            $end = isset($data['end_at']) ? Carbon::parse($data['end_at']) : $lockedBooking->end_at->copy();
            if ($start->lessThanOrEqualTo(now())) {
                throw ValidationException::withMessages(['start_at' => 'The start time must be in the future.']);
            }
            if ($end->lessThanOrEqualTo($start)) {
                throw ValidationException::withMessages(['end_at' => 'The end time must be after the start time.']);
            }

            $overlapExists = Booking::query()
                ->where('resource_id', $resource->id)
                ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
                ->where('id', '!=', $lockedBooking->id)
                ->where('start_at', '<', $end)
                ->where('end_at', '>', $start)
                ->exists();
            if ($overlapExists) {
                throw ValidationException::withMessages(['start_at' => 'This resource is already booked during the selected period.']);
            }

            $totalPrice = $this->calculatePrice($resource, $start, $end);
            $existingPayments = $lockedBooking->payments()->lockForUpdate()->get();
            if ($existingPayments->contains(fn ($payment) => in_array($payment->status, [PaymentStatus::PAID, PaymentStatus::REFUNDED], true))) {
                throw ValidationException::withMessages(['booking' => 'A paid or refunded booking cannot be changed. Contact the workspace for help.']);
            }
            if ($existingPayments->contains(fn ($payment) => $payment->status === PaymentStatus::PENDING && $payment->payment_method !== 'card')) {
                throw ValidationException::withMessages(['booking' => 'A booking with a pending manual payment submission cannot be changed. Contact the workspace first.']);
            }

            $lockedBooking->update(['resource_id' => $resource->id, 'start_at' => $start, 'end_at' => $end, 'total_price' => $totalPrice]);
            foreach ($existingPayments->where('status', PaymentStatus::PENDING)->where('payment_method', 'card') as $existingPayment) {
                $existingPayment->update(['amount' => $totalPrice]);
            }
            return $lockedBooking->fresh();
        }, attempts: 3);
    }

    /** Expire eligible unpaid pending holds, returning the number changed. */
    public function expirePendingPaymentHolds(): int
    {
        $ids = Booking::query()->where('status', BookingStatus::PENDING)
            ->whereNotNull('payment_deadline_at')->where('payment_deadline_at', '<=', now())
            ->whereDoesntHave('payments', fn ($query) => $query->where('status', PaymentStatus::PENDING)->where('payment_method', 'bank_transfer'))
            ->orderBy('id')->pluck('id');

        $expired = 0;
        foreach ($ids as $id) {
            $expired += $this->expireIfPaymentDeadlinePassed((int) $id) ? 1 : 0;
        }
        return $expired;
    }

    /** Expire a booking on demand before an API operation; resources are locked before bookings. */
    public function expireIfPaymentDeadlinePassed(Booking|int $booking): bool
    {
        $bookingId = $booking instanceof Booking ? $booking->id : $booking;
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $resourceId = Booking::query()->whereKey($bookingId)->value('resource_id');
            if (!$resourceId) {
                return false;
            }
            $result = DB::transaction(function () use ($bookingId, $resourceId): ?bool {
                Resource::query()->lockForUpdate()->findOrFail($resourceId);
                $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($bookingId);
                if ((int) $lockedBooking->resource_id !== (int) $resourceId) {
                    return null;
                }
                return $this->expireLockedBookingIfDue($lockedBooking);
            }, attempts: 3);
            if ($result !== null) {
                return $result;
            }
        }
        throw ValidationException::withMessages(['booking' => 'The booking changed while it was being processed. Please retry.']);
    }

    /** Caller must hold the resource and booking locks in that order. */
    public function expireLockedBookingIfDue(Booking $booking): bool
    {
        if ($booking->status !== BookingStatus::PENDING
            || !$booking->payment_deadline_at
            || $booking->payment_deadline_at->isFuture()
            || $this->hasPendingBankTransferReview($booking)
            || app(PaymentService::class)->summary($booking)['fully_paid']) {
            return false;
        }
        $booking->update(['status' => BookingStatus::CANCELLED]);
        $this->recordLifecycleEvent($booking, 'expired', null, ['reason' => 'payment_deadline_elapsed']);
        // WorkspaceActivityNotification uses the database channel, so this
        // notification commits or rolls back with the expiration transition.
        app(NotificationService::class)->bookingExpired($booking);
        return true;
    }

    public function hasPendingBankTransferReview(Booking $booking): bool
    {
        return $booking->payments()->where('status', PaymentStatus::PENDING)
            ->where('payment_method', 'bank_transfer')->exists();
    }

    /** The resource lock is held before locking expired bookings. */
    private function expireExpiredHoldsForLockedResource(int $resourceId): void
    {
        $bookings = Booking::query()->where('resource_id', $resourceId)
            ->where('status', BookingStatus::PENDING)
            ->whereNotNull('payment_deadline_at')->where('payment_deadline_at', '<=', now())
            ->whereDoesntHave('payments', fn ($query) => $query->where('status', PaymentStatus::PENDING)->where('payment_method', 'bank_transfer'))
            ->orderBy('id')->lockForUpdate()->get();

        foreach ($bookings as $booking) {
            $this->expireLockedBookingIfDue($booking);
        }
    }


    private function calculatePrice(
        Resource $resource,
        Carbon $start,
        Carbon $end
    ): float {
        $quantity = match ($resource->pricing_unit) {
            // Bill exact elapsed time; fractional hours are charged fractionally.
            PricingUnit::HOUR => $start->diffInSeconds($end) / 3600,

            // Every calendar date touched by the booking is one billable day.
            // Thus any same-day booking costs one day, and crossing midnight
            // starts another billable day. The end is exclusive, so a booking
            // ending exactly at midnight does not consume that new date.
            PricingUnit::DAY => $this->billableDays($start, $end),

            // Bill complete month periods anchored to the booking start.
            // A partial month is rounded up to the next whole month; there is
            // no hourly or daily proration of a monthly rate.
            PricingUnit::MONTH => $this->billableMonths($start, $end),
        };

        return round($quantity * (float) $resource->price, 2);
    }

    private function billableMonths(Carbon $start, Carbon $end): int
    {
        $months = max(0, (int) floor($start->diffInMonths($end)));

        while ($months > 0 && $start->copy()->addMonthsNoOverflow($months)->gt($end)) {
            $months--;
        }

        $periodEnd = $start->copy()->addMonthsNoOverflow($months);
        if ($periodEnd->lt($end)) {
            $months++;
        }

        return max(1, $months);
    }

    private function billableDays(Carbon $start, Carbon $end): int
    {
        // Compare date labels in UTC so daylight saving transitions do not
        // turn a calendar date into a fractional day.
        $firstDate = Carbon::parse($start->toDateString(), 'UTC');
        $lastDate = Carbon::parse(
            $end->copy()->subMicrosecond()->toDateString(),
            'UTC'
        );

        return $firstDate->diffInDays($lastDate) + 1;
    }


    public function confirm(Booking $booking, ?int $actorId = null, ?string $source = null): Booking
    {
        $this->expireIfPaymentDeadlinePassed($booking);
        return DB::transaction(function () use ($booking, $actorId, $source): Booking {
            $resourceId = Booking::query()->whereKey($booking->id)->value('resource_id');
            $resource = Resource::query()->lockForUpdate()->findOrFail($resourceId);
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->expireExpiredHoldsForLockedResource($resource->id);
            if ($booking->status !== BookingStatus::PENDING) {
                throw ValidationException::withMessages(['status' => 'Only pending bookings can be confirmed.']);
            }
            if ($booking->start_at->lessThanOrEqualTo(now())) {
                throw ValidationException::withMessages(['booking' => 'This booking period has expired and cannot be confirmed.']);
            }
            if (!app(PaymentService::class)->summary($booking)['fully_paid']) {
                throw ValidationException::withMessages(['payment' => 'The full booking amount must be received and verified before confirmation.']);
            }

            if ($booking->resource_id !== $resource->id) {
                throw ValidationException::withMessages(['booking' => 'The resource changed while confirming this booking. Please retry.']);
            }
            if ($resource->status !== ResourceStatus::ACTIVE) {
                throw ValidationException::withMessages(['resource' => 'This resource is no longer available. The verified payment needs workspace reconciliation.']);
            }
            $overlap = Booking::query()->where('resource_id', $resource->id)
                ->where('id', '!=', $booking->id)
                ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
                ->where('start_at', '<', $booking->end_at)
                ->where('end_at', '>', $booking->start_at)
                ->exists();
            if ($overlap) {
                throw ValidationException::withMessages(['booking' => 'The resource is no longer available for this booking. The verified payment needs workspace reconciliation.']);
            }

            $booking->update(['status' => BookingStatus::CONFIRMED]);
            $this->recordLifecycleEvent($booking, 'confirmed', $actorId, $source ? ['source' => $source] : []);
            return $booking->fresh();
        });
    }

    public function reject(Booking $booking, int $actorId): Booking
    {
        return DB::transaction(function () use ($booking, $actorId) {
            $resourceId = Booking::query()->whereKey($booking->id)->value('resource_id');
            Resource::query()->lockForUpdate()->findOrFail($resourceId);
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);

            if ($booking->status !== BookingStatus::PENDING) {
                throw ValidationException::withMessages([
                    'status' => 'Only pending bookings can be rejected.',
                ]);
            }

            $booking->update(['status' => BookingStatus::REJECTED]);
            $this->failPendingPayments($booking, 'Booking rejected before the declaration was approved.', $actorId);
            $this->recordLifecycleEvent($booking, 'rejected', $actorId);

            return $booking->fresh();
        });
    }


    public function checkIn(Booking $booking, int $actorId): Booking
    {
        return DB::transaction(function () use ($booking, $actorId) {
            $resourceId = Booking::query()->whereKey($booking->id)->value('resource_id');
            Resource::query()->lockForUpdate()->findOrFail($resourceId);
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);

            if ($booking->status !== BookingStatus::CONFIRMED) {
                throw ValidationException::withMessages([
                    'status' => 'Only confirmed bookings can be checked in.',
                ]);
            }

            $checkedInAt = now();
            if (!$this->canCheckIn($booking, $checkedInAt)) {
                throw ValidationException::withMessages([
                    'status' => 'Check-in requires a fully verified payment and is available from 15 minutes before the booking starts until it ends.',
                ]);
            }

            $booking->update([
                'status' => BookingStatus::CHECKED_IN,
                'checked_in_at' => $checkedInAt,
            ]);
            $this->recordLifecycleEvent($booking, 'checked_in', $actorId);

            return $booking->fresh();
        });
    }

    public function canCheckIn(Booking $booking, ?\Carbon\CarbonInterface $at = null): bool
    {
        $at ??= now();

        return $booking->status === BookingStatus::CONFIRMED
            && app(PaymentService::class)->isEligibleForAccess($booking)
            && $at->greaterThanOrEqualTo($booking->start_at->copy()->subMinutes(15))
            && $at->lessThan($booking->end_at);
    }

    public function checkOut(Booking $booking, int $actorId): Booking
    {
        return DB::transaction(function () use ($booking, $actorId) {
            $resourceId = Booking::query()->whereKey($booking->id)->value('resource_id');
            Resource::query()->lockForUpdate()->findOrFail($resourceId);
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);

            if ($booking->status !== BookingStatus::CHECKED_IN) {
                throw ValidationException::withMessages([
                    'status' => 'Only checked-in bookings can be checked out.',
                ]);
            }

            $booking->update([
                'status' => BookingStatus::COMPLETED,
                'checked_out_at' => now(),
            ]);
            $this->failPendingPayments($booking, 'Booking completed before the declaration was approved.', $actorId);
            $this->recordLifecycleEvent($booking, 'completed', $actorId);

            return $booking->fresh();
        });
    }

    public function markNoShows(NotificationService $notificationService): int
    {
        $cutoff = now();
        $marked = 0;

        $ids = Booking::query()
            ->where('status', BookingStatus::CONFIRMED)
            ->where('end_at', '<=', $cutoff)
            ->orderBy('id')->pluck('id');

        foreach ($ids as $id) {
            $resourceId = Booking::query()->whereKey($id)->value('resource_id');
            if (!$resourceId) continue;
            DB::transaction(function () use ($id, $resourceId, $cutoff, &$marked, $notificationService): void {
                Resource::query()->lockForUpdate()->findOrFail($resourceId);
                $booking = Booking::query()->lockForUpdate()->findOrFail($id);
                if ($booking->resource_id !== $resourceId || $booking->status !== BookingStatus::CONFIRMED || $booking->end_at->gt($cutoff)) {
                    return;
                }
                $booking->update(['status' => BookingStatus::NO_SHOW]);
                $this->failPendingPayments($booking, 'Booking was marked no-show before the declaration was approved.', null);
                $this->recordLifecycleEvent($booking, 'no_show', null, ['source' => 'scheduled_command']);
                $notificationService->bookingMarkedNoShow($booking);
                $marked++;
            }, attempts: 3);
        }

        return $marked;
    }

    public function cancel(
        Booking $booking,
        int $actorId,
    ): Booking {
        return DB::transaction(function () use ($booking, $actorId): Booking {
            $resourceId = Booking::query()->whereKey($booking->id)->value('resource_id');
            Resource::query()->lockForUpdate()->findOrFail($resourceId);
            $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if (!in_array($lockedBooking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)) {
                throw ValidationException::withMessages(['status' => 'Only pending or confirmed bookings can be cancelled.']);
            }
            if (now()->gte($lockedBooking->start_at)) {
                throw ValidationException::withMessages(['booking' => 'A booking cannot be cancelled after it has started.']);
            }
            $lockedBooking->update(['status' => BookingStatus::CANCELLED]);
            $this->failPendingPayments($lockedBooking, 'Booking cancelled before the declaration was approved.', $actorId);
            $this->recordLifecycleEvent($lockedBooking, 'cancelled', $actorId, ['paid_payments_refunded' => false]);
            return $lockedBooking->fresh();
        }, attempts: 3);
    }

    private function failPendingPayments(Booking $booking, string $reason, ?int $actorId): void
    {
        foreach ($booking->payments()->where('status', PaymentStatus::PENDING)->lockForUpdate()->get() as $payment) {
            $payment->update([
                'status' => PaymentStatus::FAILED,
                'verified_by' => $actorId,
                'verified_at' => now(),
                'rejection_reason' => $reason,
            ]);
        }
    }

    /** Keep a transactional actor/time record for every sensitive booking transition. */
    private function recordLifecycleEvent(Booking $booking, string $event, ?int $actorId, array $details = []): void
    {
        $booking->lifecycleEvents()->create([
            'actor_id' => $actorId,
            'event' => $event,
            'details' => $details ?: null,
            'occurred_at' => now(),
        ]);
    }
}
