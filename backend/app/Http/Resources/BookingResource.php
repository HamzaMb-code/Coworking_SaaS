<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Services\BookingService;

class BookingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        $paymentSummary = app(\App\Services\PaymentService::class)->summary($this->resource);
        return [
            'id' => $this->id,
            'created_at' => $this->created_at,

            'start_at' => $this->start_at,
            'end_at' => $this->end_at,
            'payment_deadline_at' => $this->payment_deadline_at,
            // Expiration reuses the cancelled status, while the lifecycle event
            // lets clients distinguish timeout from an explicit cancellation.
            'expired' => $this->status === \App\BookingStatus::CANCELLED
                && $this->lifecycleEvents()->where('event', 'expired')->exists(),
            'checked_in_at' => $this->checked_in_at,
            'checked_out_at' => $this->checked_out_at,
            'is_overdue' => $this->isOverdue(),
            'can_check_in' => app(BookingService::class)->canCheckIn($this->resource),

            'total_price' => $this->total_price,
            'payment_method' => $this->payment_method,
            'status' => $this->status,
            'verified_amount' => $paymentSummary['verified_amount'],
            'outstanding_balance' => $paymentSummary['outstanding_balance'],
            'pending_payment_amount' => $paymentSummary['pending_amount'],
            'fully_paid' => $paymentSummary['fully_paid'],
            'payment_status' => $this->whenLoaded('payment', fn () => $this->payment?->status?->value),
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'id' => $this->payment->id,
                'amount' => $this->payment->amount,
                'status' => $this->payment->status->value,
                'payment_method' => $this->payment->payment_method,
                'paid_at' => $this->payment->paid_at,
            ] : null),

            'user' => $this->whenLoaded('user', function () {
                $user = $this->getRelation('user');

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ];
            }),

            'resource' => $this->whenLoaded('resource', function () {
                $resource = $this->getRelation('resource');

                return [
                    'id' => $resource->id,
                    'name' => $resource->name,
                    'type' => $resource->type,
                    'image_url' => $resource->image_url,
                ];
            }),

            'workspace' => $this->whenLoaded('workspace', function () {
                $workspace = $this->getRelation('workspace');

                return [
                    'id' => $workspace->id,
                    'name' => $workspace->name,
                    'city' => $workspace->city,
                ];
            }),
        ];
    }
}
