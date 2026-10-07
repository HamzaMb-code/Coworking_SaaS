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
                'status' => BookingStatus::PENDING,
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
        $resourceQuery = Resource::query()
            ->where('workspace_id', $workspace->id)
            ->whereKey($data['resource_id']);

        if ($lockResource) {
            $resourceQuery->lockForUpdate();
        }

        $resource = $resourceQuery->firstOrFail();
        if ($resource->status !== ResourceStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'resource_id' => 'This resource is not available for booking.',
            ]);
        }

        $start = Carbon::parse($data['start_at']);
        $end = Carbon::parse($data['end_at']);
        if ($end->lessThanOrEqualTo($start)) {
            throw ValidationException::withMessages(['end_at' => 'The end time must be after the start time.']);
        }

        $overlapExists = Booking::query()
            ->where('resource_id', $resource->id)
            ->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN])
            ->where('start_at', '<', $end)
            ->where('end_at', '>', $start)
            ->exists();

        if ($overlapExists) {
            throw ValidationException::withMessages(['start_at' => 'This resource is already booked during the selected period.']);
        }

        return [
            'resource' => $resource,
            'start_at' => $start,
            'end_at' => $end,
            'total_price' => $this->calculatePrice($resource, $start, $end),
        ];
    }


    public function update(
        User $user,
        Booking $booking,
        array $data
    ): Booking {
        $resourceId = $data['resource_id'] ?? $booking->resource_id;

        $resource = Resource::findOrFail($resourceId);

        if ($resource->workspace_id !== $booking->workspace_id) {
            throw ValidationException::withMessages([
                'resource_id' => 'The selected resource does not belong to this workspace.',
            ]);
        }

        if ($resource->status !== ResourceStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'resource_id' => 'This resource is not available for booking.',
            ]);
        }

        $start = isset($data['start_at'])
            ? Carbon::parse($data['start_at'])
            : $booking->start_at->copy();

        $end = isset($data['end_at'])
            ? Carbon::parse($data['end_at'])
            : $booking->end_at->copy();

        if ($end->lessThanOrEqualTo($start)) {
            throw ValidationException::withMessages([
                'end_at' => 'The end time must be after the start time.',
            ]);
        }

        $activeStatuses = [
            BookingStatus::PENDING,
            BookingStatus::CONFIRMED,
            BookingStatus::CHECKED_IN,
        ];

        $overlapExists = Booking::query()
            ->where('resource_id', $resource->id)
            ->whereIn('status', $activeStatuses)
            ->where('id', '!=', $booking->id)
            ->where('start_at', '<', $end)
            ->where('end_at', '>', $start)
            ->exists();

        if ($overlapExists) {
            throw ValidationException::withMessages([
                'start_at' => 'This resource is already booked during the selected period.',
            ]);
        }

        $totalPrice = $this->calculatePrice(
            $resource,
            $start,
            $end
        );

        $existingPayment = $booking->payment;
        if ($existingPayment && in_array($existingPayment->status, [
            PaymentStatus::PAID,
            PaymentStatus::REFUNDED,
        ], true)) {
            throw ValidationException::withMessages([
                'booking' => 'A paid or refunded booking cannot be changed. Contact the workspace for help.',
            ]);
        }

        $booking->update([
            'resource_id' => $resource->id,
            'start_at' => $start,
            'end_at' => $end,
            'total_price' => $totalPrice,
        ]);

        if ($existingPayment) {
            $existingPayment->update(['amount' => $totalPrice]);
        }

        return $booking->fresh();
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


    public function confirm(Booking $booking): Booking
    {
        if ($booking->status !== BookingStatus::PENDING) {
            throw ValidationException::withMessages([
                'status' => 'Only pending bookings can be confirmed.',
            ]);
        }

        $booking->update([
            'status' => BookingStatus::CONFIRMED,
        ]);

        return $booking->fresh();
    }


    public function checkIn(Booking $booking): Booking
    {
        if ($booking->status !== BookingStatus::CONFIRMED) {
            throw ValidationException::withMessages([
                'status' => 'Only confirmed bookings can be checked in.',
            ]);
        }

        if (now()->lt($booking->start_at) || now()->gte($booking->end_at)) {
            throw ValidationException::withMessages([
                'status' => 'Check-in is available only while the confirmed booking is in progress.',
            ]);
        }

        $booking->update([
            'status' => BookingStatus::CHECKED_IN,
        ]);

        return $booking->fresh();
    }

    public function complete(Booking $booking): Booking
    {
        if ($booking->status !== BookingStatus::CHECKED_IN) {
            throw ValidationException::withMessages([
                'status' => 'Only checked-in bookings can be completed.',
            ]);
        }

        $booking->update([
            'status' => BookingStatus::COMPLETED,
        ]);

        return $booking->fresh();
    }

    public function cancel(
        Booking $booking,
        PaymentService $paymentService
    ): Booking {
        if (!in_array($booking->status, [
            BookingStatus::PENDING,
            BookingStatus::CONFIRMED,
        ])) {
            throw ValidationException::withMessages([
                'status' => 'Only pending or confirmed bookings can be cancelled.',
            ]);
        }

        // 1. Booking already started
        if (now()->gte($booking->start_at)) {
            throw ValidationException::withMessages([
                'booking' => 'A booking cannot be cancelled after it has started.',
            ]);
        }

        // Cancel pending or confirmed reservations any time before they start.
        $booking->update([
            'status' => BookingStatus::CANCELLED,
        ]);

        // 4. Refund paid payment
        $payment = $booking->payment;

        if ($payment && $payment->status === PaymentStatus::PAID) {
            $paymentService->refund($payment);
        }

        return $booking->fresh();
    }
}
