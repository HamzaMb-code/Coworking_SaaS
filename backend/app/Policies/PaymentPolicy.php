<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use App\WorkspaceMemberRole;

class PaymentPolicy
{
    public function viewAny(
        User $user,
        \App\Models\Workspace $workspace
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
        Payment $payment
    ): bool {
        // Customer can view the payment of their own booking.
        if ($payment->booking->user_id === $user->id) {
            return true;
        }

        // Workspace owner/staff can view any payment.
        return $payment->booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function create(
        User $user,
        Payment $payment
    ): bool {
        return $payment->booking->user_id === $user->id;
    }

    public function update(
        User $user,
        Payment $payment
    ): bool {
        return $payment->booking->user_id === $user->id
            && $payment->status === \App\PaymentStatus::PENDING
            && $payment->payment_method === 'bank_transfer'
            && $payment->verified_by === null;
    }

    public function delete(User $user, Payment $payment): bool
    {
        return $this->update($user, $payment);
    }

    public function markAsPaid(
        User $user,
        Payment $payment
    ): bool {
        return $payment->booking->user_id !== $user->id
            && $payment->booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function markAsFailed(
        User $user,
        Payment $payment
    ): bool {
        return $payment->booking->user_id !== $user->id
            && $payment->booking->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function refund(
        User $user,
        Payment $payment
    ): bool {
        return $payment->booking->workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }
}
