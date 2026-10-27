<?php

namespace App\Policies;

use App\Models\Booking;
use App\Models\User;
use App\Models\Workspace;
use App\WorkspaceMemberRole;

class BookingPolicy
{
    public function viewAny(
        User $user,
        Workspace $workspace
    ): bool {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function view(
        User $user,
        Booking $booking
    ): bool {
        if ($booking->user_id === $user->id) {
            return true;
        }

        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function create(
        User $user,
        Workspace $workspace
    ): bool {
        return $workspace->status->value === 'active';
    }

    public function update(
        User $user,
        Booking $booking
    ): bool {
        if ($booking->user_id === $user->id) {
            return true;
        }

        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function confirm(
        User $user,
        Booking $booking
    ): bool {
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function recordCashReceived(User $user, Booking $booking): bool
    {
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [WorkspaceMemberRole::OWNER, WorkspaceMemberRole::STAFF])
            ->exists();
    }

    public function reject(
        User $user,
        Booking $booking
    ): bool {
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function checkIn(
        User $user,
        Booking $booking
    ): bool {
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function checkOut(
        User $user,
        Booking $booking
    ): bool {
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function cancel(
        User $user,
        Booking $booking
    ): bool {
        // Customer can cancel their own booking.
        if ($booking->user_id === $user->id) {
            return true;
        }

        // Owner/Staff can cancel any booking in their workspace.
        return $booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }
}
