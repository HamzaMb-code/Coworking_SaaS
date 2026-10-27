<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceActivityNotification;
use App\WorkspaceMemberRole;

class NotificationService
{
    public function bookingCreated(Booking $booking, ?int $actorId = null): void
    {
        $booking->loadMissing(['user', 'resource', 'workspace']);
        $paymentMethod = $booking->payment_method === 'bank_transfer' ? 'Bank transfer' : ($booking->payment_method === 'cash' ? 'Cash' : 'Not selected');
        if ($actorId !== null && $actorId !== $booking->user_id) {
            $this->notifyCustomer($booking, new WorkspaceActivityNotification(
                'booking.created',
                'Booking request submitted',
                "A booking request for {$booking->resource->name} at {$booking->workspace->name} was submitted for you.",
                '/bookings',
                ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
            ));
        }
        $this->notifyWorkspaceManagers(
            $booking->workspace,
            new WorkspaceActivityNotification(
                'booking.created',
                'New booking request',
                "{$booking->user->name} requested {$booking->resource->name}. Intended payment method: {$paymentMethod}.",
                $this->staffBookingUrl($booking),
                ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id, 'payment_method' => $booking->payment_method, 'payment_method_label' => $paymentMethod],
            ),
            $actorId,
        );
    }

    public function bookingConfirmed(Booking $booking): void
    {
        $booking->loadMissing(['resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.confirmed',
            'Booking confirmed',
            "Your booking for {$booking->resource->name} at {$booking->workspace->name} is confirmed.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    public function bookingExpired(Booking $booking): void
    {
        $booking->loadMissing(['user', 'resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.expired',
            'Booking expired',
            "Your unpaid booking for {$booking->resource->name} at {$booking->workspace->name} expired because its payment deadline passed. Create a new booking if you still need this resource.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    public function bookingRejected(Booking $booking): void
    {
        $booking->loadMissing(['resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.rejected',
            'Booking request declined',
            "Your booking request for {$booking->resource->name} at {$booking->workspace->name} was declined.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    public function bookingCancelled(Booking $booking, int $actorId): void
    {
        $booking->loadMissing(['user', 'resource', 'workspace']);
        $paidPaymentExists = $booking->payments()->where('status', \App\PaymentStatus::PAID->value)->exists();
        $paymentNote = $paidPaymentExists ? ' Any payment already recorded was not automatically refunded; contact the workspace about an external refund.' : '';
        $notification = new WorkspaceActivityNotification(
            'booking.cancelled',
            'Booking cancelled',
            "The booking for {$booking->resource->name} was cancelled.".$paymentNote,
            $this->staffBookingUrl($booking),
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        );
        $actorIsManager = $booking->workspace->members()
            ->where('user_id', $actorId)
            ->whereIn('role', [WorkspaceMemberRole::OWNER, WorkspaceMemberRole::STAFF])
            ->exists();

        if ($actorIsManager) {
            $this->notifyCustomer($booking, new WorkspaceActivityNotification(
                'booking.cancelled',
                'Booking cancelled',
                "Your booking for {$booking->resource->name} at {$booking->workspace->name} was cancelled.".$paymentNote,
                '/bookings',
                ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
            ));
        } else {
            $this->notifyWorkspaceManagers($booking->workspace, $notification, $actorId);
        }
    }

    public function bookingUpdated(Booking $booking, int $actorId): void
    {
        $booking->loadMissing(['user', 'resource', 'workspace']);
        $actorIsManager = $booking->workspace->members()
            ->where('user_id', $actorId)
            ->whereIn('role', [WorkspaceMemberRole::OWNER, WorkspaceMemberRole::STAFF])
            ->exists();
        $notification = new WorkspaceActivityNotification(
            'booking.updated',
            'Booking updated',
            "The booking for {$booking->resource->name} at {$booking->workspace->name} has been updated.",
            $this->staffBookingUrl($booking),
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        );

        if ($actorIsManager) {
            $this->notifyCustomer($booking, new WorkspaceActivityNotification(
                'booking.updated',
                'Booking updated',
                "Your booking for {$booking->resource->name} at {$booking->workspace->name} has been updated.",
                '/bookings',
                ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
            ));
        } else {
            $this->notifyWorkspaceManagers($booking->workspace, $notification, $actorId);
        }
    }

    public function bookingCheckedIn(Booking $booking): void
    {
        $booking->loadMissing(['resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.checked_in',
            'Check-in recorded',
            "Your booking for {$booking->resource->name} has been checked in.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    public function bookingCompleted(Booking $booking): void
    {
        $booking->loadMissing(['resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.completed',
            'Booking completed',
            "Your booking for {$booking->resource->name} at {$booking->workspace->name} is complete.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    public function bookingMarkedNoShow(Booking $booking): void
    {
        $booking->loadMissing(['user', 'resource', 'workspace']);
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            'booking.no_show',
            'Booking marked as no-show',
            "Your booking for {$booking->resource->name} at {$booking->workspace->name} was marked as a no-show.",
            '/bookings',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
        $this->notifyWorkspaceManagers(
            $booking->workspace,
            new WorkspaceActivityNotification(
                'booking.no_show',
                'Booking marked as no-show',
                "{$booking->user->name}'s booking for {$booking->resource->name} was marked as a no-show.",
                $this->staffBookingUrl($booking),
                ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
            ),
        );
    }

    public function paymentStatusChanged(Payment $payment, string $status): void
    {
        $payment->loadMissing(['booking.user', 'booking.workspace', 'booking.resource']);
        $booking = $payment->booking;
        $title = match ($status) {
            'paid' => 'Payment approved',
            'failed' => 'Payment submission rejected',
            'refunded' => 'Payment refunded',
            default => 'Payment updated',
        };
        $this->notifyCustomer($booking, new WorkspaceActivityNotification(
            "payment.{$status}",
            $title,
            match ($status) {
                'paid' => $payment->receipt_path
                    ? "Your payment declaration for booking #{$booking->id} has been approved. Your payment receipt is available to download."
                    : "Your payment for booking #{$booking->id} was recorded, but receipt generation failed. Contact the workspace if you need the receipt.",
                'failed' => "Your payment declaration for booking #{$booking->id} has been rejected. Reason: ".($payment->rejection_reason ?: 'Please contact the workspace.')." Please review the details and submit a corrected declaration if your booking is still eligible.",
                'refunded' => "A payment for booking #{$booking->id} at {$booking->workspace->name} has been refunded.",
                default => "The payment for booking #{$booking->id} at {$booking->workspace->name} is {$status}.",
            },
            '/payments',
            ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id, 'payment_id' => $payment->id],
        ));
    }

    public function paymentSubmitted(Payment $payment): void
    {
        $payment->loadMissing(['booking.user', 'booking.workspace', 'booking.resource']);
        $booking = $payment->booking;

        $this->notifyWorkspaceManagers(
            $booking->workspace,
            new WorkspaceActivityNotification(
                'payment.submitted', 'New payment declaration',
                "{$booking->user->name} submitted a bank-transfer declaration for Booking {$booking->id}. Review the proof and verify the full amount before approval.",
                "/workspaces/{$booking->workspace_id}/payments",
                ['booking_id' => $booking->id, 'payment_id' => $payment->id, 'workspace_id' => $booking->workspace_id],
            ),
        );

        $booking->user->notify(new WorkspaceActivityNotification(
            'payment.submitted', 'Payment submission received',
            'Your payment submission is awaiting verification by '.$booking->workspace->name.'.',
            '/payments', ['booking_id' => $booking->id, 'payment_id' => $payment->id],
        ));
    }

    public function bookingFullyPaid(Booking $booking): void
    {
        $booking->loadMissing(['user', 'workspace']);
        $booking->user->notify(new WorkspaceActivityNotification(
            'payment.booking_fully_paid', 'Booking balance verified',
            "The full payment for your booking at {$booking->workspace->name} has been verified. Your booking is financially eligible for access.",
            '/bookings', ['booking_id' => $booking->id, 'workspace_id' => $booking->workspace_id],
        ));
    }

    private function notifyCustomer(Booking $booking, WorkspaceActivityNotification $notification): void
    {
        $booking->user->notify($notification);
    }

    private function notifyWorkspaceManagers(
        Workspace $workspace,
        WorkspaceActivityNotification $notification,
        ?int $exceptUserId = null,
    ): void {
        $users = $workspace->members()
            ->whereIn('role', [WorkspaceMemberRole::OWNER, WorkspaceMemberRole::STAFF])
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter(fn ($user) => $user && $user->id !== $exceptUserId)
            ->unique('id');

        $users->each(fn (User $user) => $user->notify(clone $notification));
    }

    private function staffBookingUrl(Booking $booking): string
    {
        return "/workspaces/{$booking->workspace_id}/bookings/today?bookingId={$booking->id}";
    }
}
